import { NOTIFICATION_FILTERS, NOTIFICATION_PAGE_LIMIT } from './notification.constants'
import type { NotificationFilters } from './notification.types'
import { ApiError } from '@/shared/services/api/api-error'

export function readNotificationFilters(params: URLSearchParams): NotificationFilters {
  const filter = NOTIFICATION_FILTERS.find((option) => option.value === params.get('filter'))?.value ?? 'all'
  const rawPage = params.get('page')
  const parsedPage = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
  return { filter, page }
}

export function notificationFiltersToSearchParams(filters: NotificationFilters): URLSearchParams {
  return new URLSearchParams({ filter: filters.filter, page: String(filters.page) })
}

export function buildNotificationsPath(filters: NotificationFilters): string {
  const params = new URLSearchParams({ page: String(filters.page), limit: String(NOTIFICATION_PAGE_LIMIT) })
  if (filters.filter !== 'all') params.set('isRead', String(filters.filter === 'read'))
  return `notifications?${params}`
}

const dateFormatter = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' })

export function formatNotificationDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : dateFormatter.format(date)
}

export function notificationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'No tienes permiso para realizar esta acción.'
    if (error.status === 404) return 'La notificación ya no está disponible.'
    if (error.kind === 'network') return 'No pudimos conectar con el servidor.'
    if (error.status && error.status >= 500) return 'El servicio no está disponible temporalmente.'
  }
  return fallback
}
