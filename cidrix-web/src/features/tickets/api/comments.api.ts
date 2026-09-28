import type { CreateCommentInput } from '@/features/tickets/model/ticket.types'
import type { ApiClient } from '@/shared/services/api/api-client'

export function createCommentsApi(client: ApiClient) {
  return {
    create(ticketId: string, input: CreateCommentInput) {
      return client.request(`tickets/${encodeURIComponent(ticketId)}/comments`, {
        json: input,
        method: 'POST',
      })
    },
  }
}
