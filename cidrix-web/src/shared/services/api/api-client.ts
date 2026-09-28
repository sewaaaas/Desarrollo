import { getClientEnvironment } from '@/shared/config/env'
import { ApiError } from '@/shared/services/api/api-error'
import type {
  ApiEnvelope,
  ApiErrorEnvelope,
  HttpMethod,
} from '@/shared/services/api/api.types'

interface ApiRequestBaseOptions {
  accessToken?: string
  headers?: HeadersInit
  method?: HttpMethod
  responseType?: 'json' | 'blob'
  signal?: AbortSignal
}

type ApiRequestPayload =
  | { body?: never; json?: unknown }
  | { body?: BodyInit | null; json?: never }

export type ApiRequestOptions = ApiRequestBaseOptions & ApiRequestPayload

interface ApiClientDependencies {
  baseUrl?: string | (() => string)
  fetchImplementation?: typeof fetch
}

export interface ApiClient {
  request<T>(path: string, options?: ApiRequestOptions): Promise<T>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isApiEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  return isRecord(value) && Object.hasOwn(value, 'data')
}

function isApiErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (!isRecord(value) || !isRecord(value.error)) {
    return false
  }

  return (
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  )
}

function isAbortError(error: unknown): boolean {
  return isRecord(error) && error.name === 'AbortError'
}

function resolveBaseUrl(baseUrl?: string | (() => string)): string {
  const value = typeof baseUrl === 'function' ? baseUrl() : baseUrl
  return value ?? getClientEnvironment().apiUrl
}

function buildUrl(baseUrl: string, path: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
  const normalizedPath = path.replace(/^\/+/, '')

  if (/^[a-z][a-z\d+.-]*:/i.test(normalizedPath) || path.startsWith('//')) {
    throw new ApiError({
      code: 'API_INVALID_PATH',
      kind: 'protocol',
      message: 'La ruta de la API debe ser relativa',
    })
  }

  return normalizedPath === ''
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/${normalizedPath}`
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

function createHttpError(response: Response, payload: unknown): ApiError {
  if (isApiErrorEnvelope(payload)) {
    return new ApiError({
      code: payload.error.code,
      details: payload.error.details,
      kind: 'http',
      message: payload.error.message,
      status: response.status,
    })
  }

  return new ApiError({
    code: `HTTP_${response.status}`,
    kind: 'http',
    message: 'La solicitud no pudo completarse',
    status: response.status,
  })
}

export function createApiClient(
  dependencies: ApiClientDependencies = {},
): ApiClient {
  return {
    async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
      const headers = new Headers(options.headers)
      headers.set(
        'Accept',
        options.responseType === 'blob' ? '*/*' : 'application/json',
      )

      if (options.accessToken?.trim()) {
        headers.set('Authorization', `Bearer ${options.accessToken.trim()}`)
      }

      let body: BodyInit | null | undefined

      if ('json' in options && options.json !== undefined) {
        headers.set('Content-Type', 'application/json')
        body = JSON.stringify(options.json)
      } else if ('body' in options) {
        body = options.body
      }

      const fetchImplementation =
        dependencies.fetchImplementation ?? globalThis.fetch.bind(globalThis)

      let response: Response

      try {
        response = await fetchImplementation(
          buildUrl(resolveBaseUrl(dependencies.baseUrl), path),
          {
            body,
            credentials: 'include',
            headers,
            method: options.method ?? 'GET',
            signal: options.signal,
          },
        )
      } catch (error: unknown) {
        if (isAbortError(error)) {
          throw new ApiError({
            cause: error,
            code: 'API_REQUEST_ABORTED',
            kind: 'aborted',
            message: 'La solicitud fue cancelada',
          })
        }

        throw new ApiError({
          cause: error,
          code: 'API_NETWORK_ERROR',
          kind: 'network',
          message: 'No fue posible conectar con el servidor',
        })
      }

      if (response.status === 204) {
        return undefined as T
      }

      if (response.ok && options.responseType === 'blob') {
        return (await response.blob()) as T
      }

      const payload = await readJson(response)

      if (!response.ok) {
        throw createHttpError(response, payload)
      }

      if (!isApiEnvelope<T>(payload)) {
        throw new ApiError({
          code: 'API_INVALID_RESPONSE',
          kind: 'protocol',
          message: 'El servidor devolvió una respuesta inesperada',
          status: response.status,
        })
      }

      return payload.data
    },
  }
}

export const apiClient = createApiClient()
