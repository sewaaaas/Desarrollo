import type { AuthApi } from '@/features/auth/api/auth.api'
import { isUnauthorizedError } from '@/features/auth/model/auth-errors'
import type {
  AuthUser,
  LoginCredentials,
  UnauthenticatedReason,
} from '@/features/auth/model/auth.types'
import type {
  ApiClient,
  ApiRequestOptions,
} from '@/shared/services/api/api-client'
import { ApiError } from '@/shared/services/api/api-error'

type SessionInvalidationListener = (reason: UnauthenticatedReason) => void

interface AuthSessionManagerDependencies {
  apiClient: ApiClient
  authApi: AuthApi
}

export class AuthSessionUnavailableError extends Error {
  readonly code = 'AUTH_SESSION_UNAVAILABLE'

  constructor() {
    super('La sesión autenticada no está disponible')
    this.name = 'AuthSessionUnavailableError'
  }
}

export class AuthOperationSupersededError extends Error {
  readonly code = 'AUTH_OPERATION_SUPERSEDED'

  constructor() {
    super('La operación de autenticación fue reemplazada por una sesión nueva')
    this.name = 'AuthOperationSupersededError'
  }
}

function canAutoRefresh(path: string): boolean {
  const normalizedPath = path
    .split(/[?#]/, 1)[0]
    ?.replace(/^\/+|\/+$/g, '')
    .toLowerCase()
  return ![
    'auth/login',
    'auth/refresh',
    'auth/logout',
    'auth/me',
  ].includes(normalizedPath ?? '')
}

function createAbortedError(): ApiError {
  return new ApiError({
    code: 'API_REQUEST_ABORTED',
    kind: 'aborted',
    message: 'La solicitud fue cancelada',
  })
}

export class AuthSessionManager {
  #accessToken: string | null = null
  private readonly apiClient: ApiClient
  private readonly authApi: AuthApi
  private initializationPromise: Promise<AuthUser> | null = null
  private readonly listeners = new Set<SessionInvalidationListener>()
  private logoutPromise: Promise<void> | null = null
  private refreshOperationId: symbol | null = null
  private refreshPromise: Promise<string> | null = null
  private sessionBlocked = false
  private sessionGeneration = 0

  constructor({ apiClient, authApi }: AuthSessionManagerDependencies) {
    this.apiClient = apiClient
    this.authApi = authApi
  }

  subscribe(listener: SessionInvalidationListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  initialize(): Promise<AuthUser> {
    if (this.initializationPromise) {
      return this.initializationPromise
    }

    const generation = this.sessionGeneration
    const promise = this.restoreSession(generation)
    this.initializationPromise = promise
    return promise
  }

  resetInitialization(): void {
    this.initializationPromise = null
  }

  async login(credentials: LoginCredentials): Promise<AuthUser> {
    if (this.logoutPromise) {
      await this.logoutPromise
    }

    const generation = this.startSessionTransition()
    const { accessToken } = await this.authApi.login(credentials)
    this.assertCurrentGeneration(generation)
    this.#accessToken = accessToken

    try {
      const user = await this.authApi.me(accessToken)
      this.assertCurrentGeneration(generation)
      return user
    } catch (error: unknown) {
      if (this.sessionGeneration === generation) {
        this.#accessToken = null
        if (isUnauthorizedError(error)) {
          this.invalidate('expired')
        }
      }
      throw error
    }
  }

  request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    return this.requestWithSession<T>(path, options)
  }

  logout(): Promise<void> {
    if (this.logoutPromise) {
      return this.logoutPromise
    }

    const tokenSnapshot = this.#accessToken
    this.sessionGeneration += 1
    this.sessionBlocked = true
    this.#accessToken = null
    this.initializationPromise = null
    this.refreshOperationId = null
    this.refreshPromise = null
    this.emitInvalidation('logout')

    const promise = this.completeRemoteLogout(tokenSnapshot).finally(() => {
      if (this.logoutPromise === promise) {
        this.logoutPromise = null
      }
      this.sessionBlocked = false
    })
    this.logoutPromise = promise
    return promise
  }

  private async restoreSession(generation: number): Promise<AuthUser> {
    const accessToken = await this.refreshAccessToken(generation)

    try {
      const user = await this.authApi.me(accessToken)
      this.assertCurrentGeneration(generation)
      return user
    } catch (error: unknown) {
      if (this.sessionGeneration === generation) {
        this.#accessToken = null
        if (isUnauthorizedError(error)) {
          this.invalidate('expired')
        }
      }
      throw error
    }
  }

  private async requestWithSession<T>(
    path: string,
    options: ApiRequestOptions,
  ): Promise<T> {
    if (this.sessionBlocked || !this.#accessToken) {
      throw new AuthSessionUnavailableError()
    }

    const generation = this.sessionGeneration
    const tokenSnapshot = this.#accessToken

    try {
      return await this.apiClient.request<T>(path, {
        ...options,
        accessToken: tokenSnapshot,
      })
    } catch (error: unknown) {
      if (
        !isUnauthorizedError(error) ||
        !canAutoRefresh(path) ||
        options.signal?.aborted
      ) {
        throw error
      }
    }

    this.assertCurrentGeneration(generation)

    let retryToken = this.#accessToken
    if (!retryToken || retryToken === tokenSnapshot) {
      retryToken = await this.refreshAccessToken(generation)
    }

    this.assertCurrentGeneration(generation)

    if (options.signal?.aborted) {
      throw createAbortedError()
    }

    try {
      return await this.apiClient.request<T>(path, {
        ...options,
        accessToken: retryToken,
      })
    } catch (error: unknown) {
      if (isUnauthorizedError(error)) {
        this.invalidate('expired')
      }
      throw error
    }
  }

  private refreshAccessToken(generation: number): Promise<string> {
    this.assertCurrentGeneration(generation)

    if (this.refreshPromise) {
      return this.refreshPromise
    }

    const operationId = Symbol('auth-refresh')
    this.refreshOperationId = operationId
    const promise = Promise.resolve().then(async () => {
      try {
        const { accessToken } = await this.authApi.refresh()
        this.assertCurrentGeneration(generation)
        this.#accessToken = accessToken
        return accessToken
      } catch (error: unknown) {
        if (
          isUnauthorizedError(error) &&
          this.sessionGeneration === generation
        ) {
          this.invalidate('expired')
        }
        throw error
      } finally {
        if (this.refreshOperationId === operationId) {
          this.refreshOperationId = null
          this.refreshPromise = null
        }
      }
    })

    this.refreshPromise = promise
    return promise
  }

  private async completeRemoteLogout(tokenSnapshot: string | null): Promise<void> {
    try {
      let logoutToken = tokenSnapshot

      if (!logoutToken) {
        logoutToken = (await this.authApi.refresh()).accessToken
      }

      try {
        await this.authApi.logout(logoutToken)
      } catch (error: unknown) {
        if (!isUnauthorizedError(error)) {
          return
        }

        const { accessToken } = await this.authApi.refresh()
        await this.authApi.logout(accessToken)
      }
    } catch {
      // El cierre local es definitivo. La cookie httpOnly solo puede limpiarla
      // el backend y puede permanecer vigente si la red o el servicio fallan.
    }
  }

  private startSessionTransition(): number {
    this.sessionGeneration += 1
    this.sessionBlocked = false
    this.#accessToken = null
    this.initializationPromise = null
    this.refreshOperationId = null
    this.refreshPromise = null
    return this.sessionGeneration
  }

  private assertCurrentGeneration(generation: number): void {
    if (this.sessionBlocked || this.sessionGeneration !== generation) {
      throw new AuthOperationSupersededError()
    }
  }

  private invalidate(reason: UnauthenticatedReason): void {
    this.sessionGeneration += 1
    this.#accessToken = null
    this.initializationPromise = null
    this.refreshOperationId = null
    this.refreshPromise = null
    this.emitInvalidation(reason)
  }

  private emitInvalidation(reason: UnauthenticatedReason): void {
    for (const listener of this.listeners) {
      listener(reason)
    }
  }
}
