import { describe, expect, it, vi } from 'vitest'
import { createAttachmentsApi } from '@/features/tickets/api/attachments.api'
import type { ApiClient } from '@/shared/services/api/api-client'

describe('attachmentsApi', () => {
  it('lista, sube, descarga y elimina con el cliente autenticado', async () => {
    const client: ApiClient = { request: vi.fn().mockResolvedValue({}) }
    const request = vi.mocked(client.request)
    const api = createAttachmentsApi(client)
    const file = new File(['contenido'], 'evidencia.txt', { type: 'text/plain' })

    await api.list('ticket/1', 2)
    await api.upload('ticket/1', file, 'INTERNAL')
    await api.download('ticket/1', 'file/1')
    await api.remove('ticket/1', 'file/1')

    expect(request).toHaveBeenNthCalledWith(
      1,
      'tickets/ticket%2F1/attachments?page=2&limit=20&order=desc',
      { signal: undefined },
    )
    const uploadOptions = request.mock.calls[1]?.[1]
    expect(uploadOptions).toMatchObject({ method: 'POST' })
    expect(uploadOptions && 'body' in uploadOptions && uploadOptions.body).toBeInstanceOf(FormData)
    const body = uploadOptions && 'body' in uploadOptions ? uploadOptions.body as FormData : null
    expect(body?.get('file')).toBe(file)
    expect(body?.get('visibility')).toBe('INTERNAL')
    expect(request).toHaveBeenNthCalledWith(
      3,
      'tickets/ticket%2F1/attachments/file%2F1/download',
      { responseType: 'blob', signal: undefined },
    )
    expect(request).toHaveBeenNthCalledWith(
      4,
      'tickets/ticket%2F1/attachments/file%2F1',
      { method: 'DELETE' },
    )
  })
})
