import { describe, expect, it, vi } from 'vitest'
import { createCommentsApi } from '@/features/tickets/api/comments.api'
import type { ApiClient } from '@/shared/services/api/api-client'

describe('commentsApi', () => {
  it('crea el comentario con contenido y visibilidad explícitos', async () => {
    const client: ApiClient = { request: vi.fn().mockResolvedValue({}) }
    const api = createCommentsApi(client)

    await api.create('ticket/1', { content: 'Nota interna', visibility: 'INTERNAL' })

    expect(client.request).toHaveBeenCalledWith('tickets/ticket%2F1/comments', {
      json: { content: 'Nota interna', visibility: 'INTERNAL' },
      method: 'POST',
    })
  })
})
