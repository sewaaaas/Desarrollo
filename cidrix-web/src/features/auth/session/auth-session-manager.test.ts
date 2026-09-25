import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthApi } from '@/features/auth/api/auth.api'
import type { AuthUser } from '@/features/auth/model/auth.types'
import {
  AuthOperationSupersededError,
  AuthSessionManager,
  AuthSessionUnavailableError,
} from '@/features/auth/session/auth-session-manager'
import type { ApiClient } from '@/shared/services/api/api-client'
import { ApiError } from '@/shared/services/api/api-error'

const user: AuthUser = {
  avatarUrl: null,
  email: 'admin@cidrix.test',
  fullName: 'Admin CIDRIX',
  id: 'user-1',
  organizationId: 'org-1',
  role: 'ADMIN',
}

const credentials = { email: user.email, password: 'secret-123' }

function unauthorizedError() {
  return new ApiError({
    code: 'UNAUTHORIZED',
    kind: 'http',
    message: 'No autorizado',
    status: 401,
  })
}

function networkError() {
  return new ApiError({
    code: 'API_NETWORK_ERROR',
    kind: 'network',
    message: 'Sin conexión',
  })
}

function forbiddenError() {
  return new ApiError({
    code: 'FORBIDDEN',
    kind: 'http',
    message: 'Sin permisos',
    status: 403,
  })
}

function serverError() {
  return new ApiError({
    code: 'HTTP_503',
    kind: 'http',
    message: 'Servicio no disponible',
    status: 503,
  })
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
}

describe('AuthSessionManager', () => {
  let apiClient: ApiClient
  let authApi: AuthApi
  let manager: AuthSessionManager

  beforeEach(() => {
    apiClient = { request: vi.fn() }
    authApi = {
      login: vi.fn(),
      logout: vi.fn(),
      me: vi.fn(),
      refresh: vi.fn(),
    }
    manager = new AuthSessionManager({ apiClient, authApi })
  })

  async function establishSession(accessToken = 'access-old') {
    vi.mocked(authApi.login).mockResolvedValueOnce({ accessToken })
    vi.mocked(authApi.me).mockResolvedValueOnce(user)
    await manager.login(credentials)
  }

  it('mantiene el token en memoria y solo lo entrega al transporte', async () => {
    await establishSession()
    vi.mocked(apiClient.request).mockResolvedValue({ ok: true })

    await manager.request('tickets')

    expect(apiClient.request).toHaveBeenCalledWith('tickets', {
      accessToken: 'access-old',
    })
    expect(Object.keys(manager)).not.toContain('token')
    expect(JSON.stringify(manager)).not.toContain('access-old')
  })

  it('restaura sesión con refresh y /me, compartiendo la inicialización', async () => {
    vi.mocked(authApi.refresh).mockResolvedValue({ accessToken: 'restored' })
    vi.mocked(authApi.me).mockResolvedValue(user)

    const first = manager.initialize()
    const second = manager.initialize()

    expect(first).toBe(second)
    await expect(first).resolves.toEqual(user)
    expect(authApi.refresh).toHaveBeenCalledOnce()
    expect(authApi.me).toHaveBeenCalledWith('restored')
  })

  it('refresca y repite una request exactamente una vez después de 401', async () => {
    await establishSession()
    vi.mocked(apiClient.request)
      .mockRejectedValueOnce(unauthorizedError())
      .mockResolvedValueOnce({ id: 'ticket-1' })
    vi.mocked(authApi.refresh).mockResolvedValue({ accessToken: 'access-new' })

    await expect(manager.request('tickets/ticket-1')).resolves.toEqual({
      id: 'ticket-1',
    })

    expect(authApi.refresh).toHaveBeenCalledOnce()
    expect(apiClient.request).toHaveBeenNthCalledWith(2, 'tickets/ticket-1', {
      accessToken: 'access-new',
    })
  })

  it('invalida la sesión si el único retry también recibe 401', async () => {
    await establishSession()
    vi.mocked(apiClient.request).mockRejectedValue(unauthorizedError())
    vi.mocked(authApi.refresh).mockResolvedValue({ accessToken: 'access-new' })
    const listener = vi.fn()
    manager.subscribe(listener)

    await expect(manager.request('tickets')).rejects.toMatchObject({ status: 401 })
    expect(apiClient.request).toHaveBeenCalledTimes(2)
    expect(authApi.refresh).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith('expired')
    await expect(manager.request('tickets')).rejects.toBeInstanceOf(
      AuthSessionUnavailableError,
    )
  })

  it('un refresh 401 invalida la sesión', async () => {
    await establishSession()
    vi.mocked(apiClient.request).mockRejectedValueOnce(unauthorizedError())
    vi.mocked(authApi.refresh).mockRejectedValueOnce(unauthorizedError())
    const listener = vi.fn()
    manager.subscribe(listener)

    await expect(manager.request('tickets')).rejects.toMatchObject({ status: 401 })
    expect(listener).toHaveBeenCalledWith('expired')
  })

  it('un fallo de red al refrescar no se convierte en sesión expirada', async () => {
    await establishSession()
    vi.mocked(apiClient.request).mockRejectedValue(unauthorizedError())
    vi.mocked(authApi.refresh).mockRejectedValue(networkError())
    const listener = vi.fn()
    manager.subscribe(listener)

    await expect(manager.request('tickets')).rejects.toMatchObject({
      kind: 'network',
    })
    expect(listener).not.toHaveBeenCalled()

    await expect(manager.request('tickets')).rejects.toMatchObject({
      kind: 'network',
    })
    expect(authApi.refresh).toHaveBeenCalledTimes(2)
  })

  it('un 5xx al refrescar tampoco se convierte en sesión expirada', async () => {
    await establishSession()
    vi.mocked(apiClient.request).mockRejectedValueOnce(unauthorizedError())
    vi.mocked(authApi.refresh).mockRejectedValueOnce(serverError())
    const listener = vi.fn()
    manager.subscribe(listener)

    await expect(manager.request('tickets')).rejects.toMatchObject({ status: 503 })
    expect(listener).not.toHaveBeenCalled()
  })

  it('propaga 403 sin refrescar ni cerrar sesión', async () => {
    await establishSession()
    vi.mocked(apiClient.request).mockRejectedValueOnce(forbiddenError())
    const listener = vi.fn()
    manager.subscribe(listener)

    await expect(manager.request('settings')).rejects.toMatchObject({ status: 403 })
    expect(authApi.refresh).not.toHaveBeenCalled()
    expect(listener).not.toHaveBeenCalled()
  })

  it('cinco requests con 401 comparten un solo refresh', async () => {
    await establishSession()
    const refresh = deferred<{ accessToken: string }>()
    vi.mocked(authApi.refresh).mockReturnValue(refresh.promise)

    let oldTokenCalls = 0
    vi.mocked(apiClient.request).mockImplementation(
      async (_path, options) => {
        if (options?.accessToken === 'access-old') {
          oldTokenCalls += 1
          throw unauthorizedError()
        }
        return { ok: true }
      },
    )

    const requests = Array.from({ length: 5 }, (_, index) =>
      manager.request<{ ok: boolean }>(`tickets/${index}`),
    )

    await vi.waitFor(() => {
      expect(oldTokenCalls).toBe(5)
      expect(authApi.refresh).toHaveBeenCalledOnce()
    })

    refresh.resolve({ accessToken: 'access-new' })
    await expect(Promise.all(requests)).resolves.toEqual(
      Array.from({ length: 5 }, () => ({ ok: true })),
    )
    expect(authApi.refresh).toHaveBeenCalledOnce()
    expect(apiClient.request).toHaveBeenCalledTimes(10)
  })

  it('usa un token ya actualizado cuando otro 401 llega tarde', async () => {
    await establishSession()
    const lateRequest = deferred<never>()
    vi.mocked(authApi.refresh).mockResolvedValue({ accessToken: 'access-new' })

    vi.mocked(apiClient.request).mockImplementation(async (path, options) => {
      if (path === 'tickets/slow' && options?.accessToken === 'access-old') {
        return lateRequest.promise
      }
      if (options?.accessToken === 'access-old') {
        throw unauthorizedError()
      }
      return { path }
    })

    const slow = manager.request<{ path: string }>('tickets/slow')
    await expect(manager.request('tickets/fast')).resolves.toEqual({
      path: 'tickets/fast',
    })

    lateRequest.reject(unauthorizedError())
    await expect(slow).resolves.toEqual({ path: 'tickets/slow' })
    expect(authApi.refresh).toHaveBeenCalledOnce()
  })

  it('una respuesta tardía de refresh no restaura sesión tras logout', async () => {
    await establishSession()
    const refresh = deferred<{ accessToken: string }>()
    vi.mocked(apiClient.request).mockRejectedValueOnce(unauthorizedError())
    vi.mocked(authApi.refresh).mockReturnValueOnce(refresh.promise)
    vi.mocked(authApi.logout).mockResolvedValue()

    const request = manager.request('tickets')
    await vi.waitFor(() => expect(authApi.refresh).toHaveBeenCalledOnce())
    await manager.logout()
    refresh.resolve({ accessToken: 'late-token' })

    await expect(request).rejects.toBeInstanceOf(AuthOperationSupersededError)
    await expect(manager.request('tickets')).rejects.toBeInstanceOf(
      AuthSessionUnavailableError,
    )
  })

  it('una respuesta tardía de refresh no reemplaza un login nuevo', async () => {
    await establishSession()
    const refresh = deferred<{ accessToken: string }>()
    vi.mocked(apiClient.request)
      .mockRejectedValueOnce(unauthorizedError())
      .mockResolvedValueOnce({ ok: true })
    vi.mocked(authApi.refresh).mockReturnValueOnce(refresh.promise)

    const staleRequest = manager.request('tickets')
    await vi.waitFor(() => expect(authApi.refresh).toHaveBeenCalledOnce())

    const newUser = { ...user, id: 'user-new' }
    vi.mocked(authApi.login).mockResolvedValueOnce({ accessToken: 'login-new' })
    vi.mocked(authApi.me).mockResolvedValueOnce(newUser)
    await expect(manager.login(credentials)).resolves.toEqual(newUser)

    refresh.resolve({ accessToken: 'late-refresh' })
    await expect(staleRequest).rejects.toBeInstanceOf(
      AuthOperationSupersededError,
    )

    await expect(manager.request('tickets')).resolves.toEqual({ ok: true })
    expect(apiClient.request).toHaveBeenLastCalledWith('tickets', {
      accessToken: 'login-new',
    })
  })

  it('si logout recibe 401 usa un refresh raw una vez y no publica el token', async () => {
    await establishSession()
    vi.mocked(authApi.logout)
      .mockRejectedValueOnce(unauthorizedError())
      .mockResolvedValueOnce()
    vi.mocked(authApi.refresh).mockResolvedValue({ accessToken: 'logout-token' })

    await manager.logout()

    expect(authApi.refresh).toHaveBeenCalledOnce()
    expect(authApi.logout).toHaveBeenNthCalledWith(1, 'access-old')
    expect(authApi.logout).toHaveBeenNthCalledWith(2, 'logout-token')
    await expect(manager.request('tickets')).rejects.toBeInstanceOf(
      AuthSessionUnavailableError,
    )
  })

  it('finaliza logout local aunque el backend no esté disponible', async () => {
    await establishSession()
    vi.mocked(authApi.logout).mockRejectedValue(networkError())

    await expect(manager.logout()).resolves.toBeUndefined()
    await expect(manager.request('tickets')).rejects.toBeInstanceOf(
      AuthSessionUnavailableError,
    )
  })

  it('no auto-refresca endpoints Auth explícitos', async () => {
    await establishSession()
    vi.mocked(apiClient.request).mockRejectedValue(unauthorizedError())

    await expect(manager.request('auth/me')).rejects.toMatchObject({ status: 401 })
    expect(authApi.refresh).not.toHaveBeenCalled()
  })

  it('respeta AbortSignal y no inicia refresh si el consumidor ya abortó', async () => {
    await establishSession()
    const controller = new AbortController()
    vi.mocked(apiClient.request).mockImplementationOnce(
      async (_path, options) => {
        expect(options?.signal).toBe(controller.signal)
        controller.abort()
        throw unauthorizedError()
      },
    )

    await expect(
      manager.request('tickets', { signal: controller.signal }),
    ).rejects.toMatchObject({ status: 401 })
    expect(authApi.refresh).not.toHaveBeenCalled()
  })
})
