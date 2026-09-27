import type {
  CreateTicketInput,
  PaginatedTicketCategories,
  PaginatedTickets,
  PaginatedTicketUsers,
  Ticket,
  TicketFilters,
} from '@/features/tickets/model/ticket.types'
import { buildTicketsPath } from '@/features/tickets/model/ticket-query'
import type { ApiClient } from '@/shared/services/api/api-client'

export function createTicketsApi(client: ApiClient) {
  return {
    list(filters: TicketFilters, signal?: AbortSignal) {
      return client.request<PaginatedTickets>(buildTicketsPath(filters), {
        signal,
      })
    },
    get(id: string, signal?: AbortSignal) {
      return client.request<Ticket>(`tickets/${encodeURIComponent(id)}`, {
        signal,
      })
    },
    create(input: CreateTicketInput) {
      return client.request<Ticket>('tickets', {
        json: input,
        method: 'POST',
      })
    },
    listCategories(signal?: AbortSignal) {
      return client.request<PaginatedTicketCategories>(
        'categories?isActive=true&page=1&limit=100',
        { signal },
      )
    },
    listActiveUsers(signal?: AbortSignal) {
      return client.request<PaginatedTicketUsers>(
        'users?status=ACTIVE&page=1&limit=100',
        { signal },
      )
    },
  }
}
