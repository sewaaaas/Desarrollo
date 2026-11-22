import { describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/shared/services/api/api-client'
import { createNotificationsApi } from './notifications.api'

function setup() {
  const client: ApiClient = { request: vi.fn().mockResolvedValue({}) }
  return { api: createNotificationsApi(client), request: vi.mocked(client.request) }
}

describe('notificationsApi', () => {
  it.each([
    ['all', 'notifications?page=2&limit=20'],
    ['unread', 'notifications?page=2&limit=20&isRead=false'],
    ['read', 'notifications?page=2&limit=20&isRead=true'],
  ] as const)('serializa %s con página y limit, incluido false', async (filter, path) => {
    const { api, request } = setup()
    const signal = new AbortController().signal
    await api.list({ filter, page: 2 }, signal)
    expect(request).toHaveBeenCalledWith(path, { signal })
  })

  it('consulta unread count con AbortSignal', async () => {
    const { api, request } = setup()
    const signal = new AbortController().signal
    await api.getUnreadCount(signal)
    expect(request).toHaveBeenCalledWith('notifications/unread-count', { signal })
  })

  it('marca individual y todas con PATCH sin body', async () => {
    const { api, request } = setup()
    const signal = new AbortController().signal
    await api.markRead('id/1', signal)
    await api.markAllRead(signal)
    expect(request).toHaveBeenNthCalledWith(1, 'notifications/id%2F1/read', { method: 'PATCH', signal })
    expect(request).toHaveBeenNthCalledWith(2, 'notifications/read-all', { method: 'PATCH', signal })
  })

  it('propaga errores de las cuatro operaciones', async () => {
    const { api, request } = setup()
    const error = new Error('fallo')
    request.mockRejectedValue(error)
    await expect(api.list({ filter: 'all', page: 1 })).rejects.toBe(error)
    await expect(api.getUnreadCount()).rejects.toBe(error)
    await expect(api.markRead('id')).rejects.toBe(error)
    await expect(api.markAllRead()).rejects.toBe(error)
  })
})
