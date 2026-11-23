import type { NotificationFilter, NotificationType } from './notification.types'

export const NOTIFICATION_PAGE_LIMIT = 20
export const NOTIFICATION_FILTERS: ReadonlyArray<{ value: NotificationFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'unread', label: 'No leídas' },
  { value: 'read', label: 'Leídas' },
]

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  TICKET_ASSIGNED: 'Asignación',
  TICKET_STATUS_CHANGED: 'Estado',
  COMMENT_ADDED: 'Comentario',
}

export const NOTIFICATION_EMPTY_MESSAGES: Record<NotificationFilter, string> = {
  all: 'No tienes notificaciones.',
  unread: 'No tienes notificaciones sin leer.',
  read: 'No tienes notificaciones leídas.',
}
