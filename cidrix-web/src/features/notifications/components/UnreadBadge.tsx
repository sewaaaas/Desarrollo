import { useNotificationsUnread } from '../context/notifications-unread-context'

export function UnreadBadge() {
  const { count } = useNotificationsUnread()
  if (count === null || count <= 0) return null
  return (
    <span aria-label={`${count} notificaciones sin leer`} className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-bold text-current">
      <span aria-hidden="true">{count > 99 ? '99+' : count}</span>
    </span>
  )
}
