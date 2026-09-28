import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiClient } from '@/shared/services/api/api-client'
import { ApiError } from '@/shared/services/api/api-error'
import type { Paginated } from '@/shared/services/api/api.types'

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

describe('apiClient', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('reads the base URL from VITE_API_URL by default', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.cidrix.example/api/v1')
    const fetchImplementation = vi.fn<typeof fetch>()
    fetchImplementation.mockResolvedValue(jsonResponse({ data: { ok: true } }))
    const client = createApiClient({ fetchImplementation })

    await client.request('health')

    expect(fetchImplementation.mock.calls[0]?.[0]).toBe(
      'https://api.cidrix.example/api/v1/health',
    )
  })

  it('builds the URL, includes credentials and unwraps one envelope level', async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
    fetchImplementation.mockResolvedValue(
      jsonResponse({ data: { id: 'ticket-1' } }),
    )
    const client = createApiClient({
      baseUrl: 'https://api.cidrix.example/api/v1/',
      fetchImplementation,
    })

    await expect(client.request<{ id: string }>('/tickets')).resolves.toEqual({
      id: 'ticket-1',
    })

    expect(fetchImplementation).toHaveBeenCalledOnce()
    expect(fetchImplementation.mock.calls[0]?.[0]).toBe(
      'https://api.cidrix.example/api/v1/tickets',
    )
    expect(fetchImplementation.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ credentials: 'include', method: 'GET' }),
    )
  })

  it('preserves the paginated payload after the global envelope unwrap', async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
    const paginatedPayload: Paginated<{ id: string }> = {
      data: [{ id: 'ticket-1' }],
      meta: { limit: 20, page: 1, total: 1, totalPages: 1 },
    }
    fetchImplementation.mockResolvedValue(
      jsonResponse({ data: paginatedPayload }),
    )
    const client = createApiClient({
      baseUrl: 'https://api.cidrix.example/api/v1',
      fetchImplementation,
    })

    await expect(
      client.request<Paginated<{ id: string }>>('tickets'),
    ).resolves.toEqual(paginatedPayload)
  })

  it('sends JSON and an optional Bearer token with the required headers', async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
    fetchImplementation.mockResolvedValue(jsonResponse({ data: { ok: true } }))
    const client = createApiClient({
      baseUrl: 'https://api.cidrix.example/api/v1',
      fetchImplementation,
    })

    await client.request('tickets', {
      accessToken: ' access-token ',
      json: { title: 'Printer issue' },
      method: 'POST',
    })

    const request = fetchImplementation.mock.calls[0]?.[1]
    const headers = new Headers(request?.headers)
    expect(headers.get('Accept')).toBe('application/json')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('Authorization')).toBe('Bearer access-token')
    expect(request?.body).toBe(JSON.stringify({ title: 'Printer issue' }))
  })

  it('does not force a content type for FormData', async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
    fetchImplementation.mockResolvedValue(jsonResponse({ data: { ok: true } }))
    const client = createApiClient({
      baseUrl: 'https://api.cidrix.example/api/v1',
      fetchImplementation,
    })

    await client.request('tickets/ticket-1/attachments', {
      body: new FormData(),
      method: 'POST',
    })

    const headers = new Headers(fetchImplementation.mock.calls[0]?.[1]?.headers)
    expect(headers.get('Content-Type')).toBeNull()
    expect(headers.get('Authorization')).toBeNull()
  })

  it('returns undefined for 204 responses', async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
    fetchImplementation.mockResolvedValue(new Response(null, { status: 204 }))
    const client = createApiClient({
      baseUrl: 'https://api.cidrix.example/api/v1',
      fetchImplementation,
    })

    await expect(client.request<void>('resource', { method: 'DELETE' })).resolves
      .toBeUndefined()
  })

  it('returns a Blob without attempting to unwrap JSON', async () => {
    const file = new Blob(['cidrix'], { type: 'text/plain' })
    const fetchImplementation = vi.fn<typeof fetch>()
    fetchImplementation.mockResolvedValue(new Response(file, { status: 200 }))
    const client = createApiClient({
      baseUrl: 'https://api.cidrix.example/api/v1',
      fetchImplementation,
    })

    const result = await client.request<Blob>('tickets/ticket-1/attachments/file/download', {
      responseType: 'blob',
    })

    expect(result).toBeInstanceOf(Blob)
    expect(result.size).toBeGreaterThan(0)
    const headers = new Headers(fetchImplementation.mock.calls[0]?.[1]?.headers)
    expect(headers.get('Accept')).toBe('*/*')
  })

  it('still maps a JSON error when a Blob request fails', async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
    fetchImplementation.mockResolvedValue(
      jsonResponse({ error: { code: 'FORBIDDEN', message: 'Sin acceso' } }, 403),
    )
    const client = createApiClient({
      baseUrl: 'https://api.cidrix.example/api/v1',
      fetchImplementation,
    })

    await expect(
      client.request<Blob>('tickets/ticket-1/attachments/file/download', {
        responseType: 'blob',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 })
  })

  it('maps the backend error envelope to ApiError', async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
    fetchImplementation.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'FORBIDDEN',
            details: { reason: 'role' },
            message: 'No tienes permisos',
          },
        },
        403,
      ),
    )
    const client = createApiClient({
      baseUrl: 'https://api.cidrix.example/api/v1',
      fetchImplementation,
    })

    const error = await client.request('settings').catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      code: 'FORBIDDEN',
      details: { reason: 'role' },
      kind: 'http',
      message: 'No tienes permisos',
      status: 403,
    })
  })

  it('maps network failures to a distinguishable ApiError', async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
    fetchImplementation.mockRejectedValue(new TypeError('Failed to fetch'))
    const client = createApiClient({
      baseUrl: 'https://api.cidrix.example/api/v1',
      fetchImplementation,
    })

    await expect(client.request('tickets')).rejects.toMatchObject({
      code: 'API_NETWORK_ERROR',
      kind: 'network',
    })
  })

  it('distinguishes request cancellation from network failures', async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
    fetchImplementation.mockRejectedValue(
      new DOMException('The operation was aborted', 'AbortError'),
    )
    const client = createApiClient({
      baseUrl: 'https://api.cidrix.example/api/v1',
      fetchImplementation,
    })
    const controller = new AbortController()

    await expect(
      client.request('tickets', { signal: controller.signal }),
    ).rejects.toMatchObject({
      code: 'API_REQUEST_ABORTED',
      kind: 'aborted',
    })
    expect(fetchImplementation.mock.calls[0]?.[1]?.signal).toBe(
      controller.signal,
    )
  })

  it('rejects successful responses without the global envelope', async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
    fetchImplementation.mockResolvedValue(jsonResponse({ id: 'ticket-1' }))
    const client = createApiClient({
      baseUrl: 'https://api.cidrix.example/api/v1',
      fetchImplementation,
    })

    await expect(client.request('tickets/ticket-1')).rejects.toMatchObject({
      code: 'API_INVALID_RESPONSE',
      kind: 'protocol',
    })
  })
})
