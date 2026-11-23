import type { ApiClient } from '@/shared/services/api/api-client'
import type { NotificationFilters, NotificationItem, PaginatedNotifications } from '../model/notification.types'
import { buildNotificationsPath } from '../model/notification.utils'

export function createNotificationsApi(client: ApiClient) {
  return {
    list(filters: NotificationFilters, signal?: AbortSignal) {
      return client.request<PaginatedNotifications>(buildNotificationsPath(filters), { signal })
    },
    getUnreadCount(signal?: AbortSignal) {
      return client.request<{ count: number }>('notifications/unread-count', { signal })
    },
    markRead(id: string, signal?: AbortSignal) {
      return client.request<NotificationItem>(`notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH', signal })
    },
    markAllRead(signal?: AbortSignal) {
      return client.request<{ updatedCount: number }>('notifications/read-all', { method: 'PATCH', signal })
    },
  }
}
