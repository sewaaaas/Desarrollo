import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from '@/features/tickets/model/ticket.constants'
import type {
  SortOrder,
  TicketFilters,
  TicketPriority,
  TicketSortBy,
  TicketStatus,
} from '@/features/tickets/model/ticket.types'

const SORT_FIELDS: readonly TicketSortBy[] = [
  'createdAt',
  'updatedAt',
  'priority',
  'status',
  'number',
]
const LIMITS = [20, 50, 100] as const

function isOneOf<T extends string>(
  value: string | null,
  choices: readonly T[],
): value is T {
  return value !== null && choices.includes(value as T)
}

function positiveInteger(value: string | null, fallback: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback
  const number = Number(value)
  return number >= 1 ? number : fallback
}

function meaningful(value: string | null): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

export function readTicketFilters(searchParams: URLSearchParams): TicketFilters {
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const sortBy = searchParams.get('sortBy')
  const sortOrder = searchParams.get('sortOrder')
  const requestedLimit = positiveInteger(searchParams.get('limit'), 20)

  return {
    search: meaningful(searchParams.get('search')),
    status: isOneOf(status, TICKET_STATUSES)
      ? (status as TicketStatus)
      : undefined,
    priority: isOneOf(priority, TICKET_PRIORITIES)
      ? (priority as TicketPriority)
      : undefined,
    categoryId: meaningful(searchParams.get('categoryId')),
    assignedToId: meaningful(searchParams.get('assignedToId')),
    createdById: meaningful(searchParams.get('createdById')),
    dateFrom: meaningful(searchParams.get('dateFrom')),
    dateTo: meaningful(searchParams.get('dateTo')),
    sortBy: isOneOf(sortBy, SORT_FIELDS)
      ? (sortBy as TicketSortBy)
      : 'createdAt',
    sortOrder: isOneOf(sortOrder, ['asc', 'desc'] as const)
      ? (sortOrder as SortOrder)
      : 'desc',
    page: positiveInteger(searchParams.get('page'), 1),
    limit: LIMITS.includes(requestedLimit as (typeof LIMITS)[number])
      ? requestedLimit
      : 20,
  }
}

export function ticketFiltersToSearchParams(
  filters: TicketFilters,
): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.search) params.set('search', filters.search)
  if (filters.status) params.set('status', filters.status)
  if (filters.priority) params.set('priority', filters.priority)
  if (filters.categoryId) params.set('categoryId', filters.categoryId)
  if (filters.assignedToId) params.set('assignedToId', filters.assignedToId)
  if (filters.createdById) params.set('createdById', filters.createdById)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.sortBy !== 'createdAt') params.set('sortBy', filters.sortBy)
  if (filters.sortOrder !== 'desc') params.set('sortOrder', filters.sortOrder)
  if (filters.page !== 1) params.set('page', String(filters.page))
  if (filters.limit !== 20) params.set('limit', String(filters.limit))

  return params
}

export function buildTicketsPath(filters: TicketFilters): string {
  const params = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })

  return `tickets?${params.toString()}`
}
