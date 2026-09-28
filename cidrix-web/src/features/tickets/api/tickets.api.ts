import type {
  CreateTicketInput,
  AssignTicketInput,
  PaginatedTimeline,
  PaginatedTicketCategories,
  PaginatedTickets,
  PaginatedTicketUsers,
  Ticket,
  TicketFilters,
  UpdateTicketInput,
  UpdateTicketStatusInput,
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
    update(id: string, input: UpdateTicketInput) {
      return client.request<Ticket>(`tickets/${encodeURIComponent(id)}`, {
        json: input,
        method: 'PATCH',
      })
    },
    assign(id: string, input: AssignTicketInput) {
      return client.request<Ticket>(`tickets/${encodeURIComponent(id)}/assign`, {
        json: input,
        method: 'PATCH',
      })
    },
    updateStatus(id: string, input: UpdateTicketStatusInput) {
      return client.request<Ticket>(`tickets/${encodeURIComponent(id)}/status`, {
        json: input,
        method: 'PATCH',
      })
    },
    getTimeline(id: string, page = 1, signal?: AbortSignal) {
      return client.request<PaginatedTimeline>(
        `tickets/${encodeURIComponent(id)}/history?page=${page}&limit=20&order=desc`,
        { signal },
      )
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
