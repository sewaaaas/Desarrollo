import type { Paginated } from '@/shared/services/api/api.types'
import type { UserRole } from '@/features/auth/model/auth.types'

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

export type CommentVisibility = 'PUBLIC' | 'INTERNAL'

export type TicketHistoryAction =
  | 'CREATED'
  | 'UPDATED'
  | 'ASSIGNED'
  | 'UNASSIGNED'
  | 'STATUS_CHANGED'
  | 'CANCELLED'
  | 'CLOSED'
  | 'FIRST_RESPONSE'

export interface TimelineActor {
  id: string
  name: string
  role: UserRole
}

export type TimelineItem =
  | {
      id: string
      type: 'COMMENT'
      timestamp: string
      actor: TimelineActor
      content: string
      visibility: CommentVisibility
    }
  | {
      id: string
      type: 'HISTORY'
      timestamp: string
      actor: TimelineActor | null
      action: TicketHistoryAction
      changes: unknown | null
    }

export type PaginatedTimeline = Paginated<TimelineItem>

export interface UpdateTicketInput {
  title?: string
  description?: string
  priority?: TicketPriority
  categoryId?: string | null
  version: number
}

export interface AssignTicketInput {
  assignedToId: string | null
  version: number
}

export interface UpdateTicketStatusInput {
  status: TicketStatus
  version: number
}

export interface CreateCommentInput {
  content: string
  visibility: CommentVisibility
}

export interface Attachment {
  id: string
  ticketId: string
  commentId: string | null
  originalName: string
  mimeType: string
  sizeBytes: number
  visibility: CommentVisibility
  uploadedBy: TimelineActor
  createdAt: string
}

export type PaginatedAttachments = Paginated<Attachment>
