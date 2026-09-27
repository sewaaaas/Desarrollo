import type { Paginated } from '@/shared/services/api/api.types'

export type TicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'PENDING'
  | 'RESOLVED'
  | 'CLOSED'
  | 'CANCELLED'

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type TicketSortBy =
  | 'createdAt'
  | 'updatedAt'
  | 'priority'
  | 'status'
  | 'number'

export type SortOrder = 'asc' | 'desc'

export interface TicketUser {
  id: string
  fullName: string
  avatarUrl: string | null
}

export interface TicketCategory {
  id: string
  name: string
  slug: string
}

export interface Ticket {
  id: string
  ticketNumber: string
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  version: number
  createdBy: TicketUser
  assignedTo: TicketUser | null
  category: TicketCategory | null
  firstResponseAt: string | null
  resolvedAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

export type PaginatedTickets = Paginated<Ticket>

export interface TicketFilters {
  search?: string
  status?: TicketStatus
  priority?: TicketPriority
  categoryId?: string
  assignedToId?: string
  createdById?: string
  dateFrom?: string
  dateTo?: string
  sortBy: TicketSortBy
  sortOrder: SortOrder
  page: number
  limit: number
}

export interface CreateTicketInput {
  title: string
  description: string
  priority?: TicketPriority
  categoryId?: string
  assignedToId?: string
}

export interface TicketOptionCategory {
  id: string
  name: string
  slug: string
  isActive: boolean
}

export interface TicketOptionUser {
  id: string
  fullName: string
  role: 'ADMIN' | 'TECHNICIAN' | 'USER'
  status: 'ACTIVE' | 'INACTIVE' | 'DELETED'
}

export type PaginatedTicketCategories = Paginated<TicketOptionCategory>
export type PaginatedTicketUsers = Paginated<TicketOptionUser>
