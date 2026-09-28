import type {
  Attachment,
  CommentVisibility,
  PaginatedAttachments,
} from '@/features/tickets/model/ticket.types'
import type { ApiClient } from '@/shared/services/api/api-client'

export function createAttachmentsApi(client: ApiClient) {
  return {
    list(ticketId: string, page = 1, signal?: AbortSignal) {
      return client.request<PaginatedAttachments>(
        `tickets/${encodeURIComponent(ticketId)}/attachments?page=${page}&limit=20&order=desc`,
        { signal },
      )
    },
    upload(
      ticketId: string,
      file: File,
      visibility: CommentVisibility,
    ) {
      const body = new FormData()
      body.append('file', file)
      body.append('visibility', visibility)
      return client.request<Attachment>(
        `tickets/${encodeURIComponent(ticketId)}/attachments`,
        { body, method: 'POST' },
      )
    },
    download(ticketId: string, attachmentId: string, signal?: AbortSignal) {
      return client.request<Blob>(
        `tickets/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(attachmentId)}/download`,
        { responseType: 'blob', signal },
      )
    },
    remove(ticketId: string, attachmentId: string) {
      return client.request<void>(
        `tickets/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(attachmentId)}`,
        { method: 'DELETE' },
      )
    },
  }
}
