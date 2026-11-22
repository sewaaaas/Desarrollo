import type { Paginated } from '@/shared/services/api/api.types'

export type NotificationType = 'TICKET_ASSIGNED' | 'TICKET_STATUS_CHANGED' | 'COMMENT_ADDED'
export type NotificationFilter = 'all' | 'unread' | 'read'

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  message: string
  ticketId: string
  ticketNumber: string
  isRead: boolean
  readAt: string | null
  createdAt: string
}

export interface NotificationFilters {
  filter: NotificationFilter
  page: number
}

export type PaginatedNotifications = Paginated<NotificationItem>
