import { Link } from 'react-router'
import { Button } from '@/shared/components/Button'
import type { NotificationItem } from '../model/notification.types'
import { NOTIFICATION_TYPE_LABELS } from '../model/notification.constants'
import { formatNotificationDate } from '../model/notification.utils'

export function NotificationCard({ item, busy, marking, onMarkRead }: { item: NotificationItem; busy: boolean; marking: boolean; onMarkRead: (id: string) => void }) {
  return (
    <li className={`min-w-0 p-5 sm:p-6 ${item.isRead ? 'bg-surface' : 'bg-primary/5'}`}>
      <article aria-label={`${item.title}, ${item.isRead ? 'leída' : 'no leída'}`}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-semibold ${item.isRead ? 'bg-surface-muted' : 'bg-primary/10 text-primary'}`}>
            {!item.isRead ? <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" /> : null}
            {item.isRead ? 'Leída' : 'No leída'}
          </span>
          <span>{NOTIFICATION_TYPE_LABELS[item.type]}</span>
        </div>
        <h2 className="mt-3 break-words text-base font-semibold text-foreground [overflow-wrap:anywhere]">{item.title}</h2>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground-muted [overflow-wrap:anywhere]">{item.message}</p>
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-xs text-foreground-muted">
            <span className="break-all font-semibold text-foreground">{item.ticketNumber}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={item.createdAt}>{formatNotificationDate(item.createdAt)}</time>
          </p>
          <div className="flex flex-wrap gap-2">
            <Link aria-label={`Ver ticket ${item.ticketNumber}`} className="inline-flex min-h-9 items-center rounded-control border border-border bg-surface px-3 text-sm font-semibold text-primary hover:bg-surface-muted" to={`/tickets/${encodeURIComponent(item.ticketId)}`}>Ver ticket</Link>
            {!item.isRead ? <Button aria-label={`Marcar como leída ${item.ticketNumber}`} disabled={busy} isLoading={marking} onClick={() => onMarkRead(item.id)} size="sm" variant="secondary">Marcar como leída</Button> : null}
          </div>
        </div>
      </article>
    </li>
  )
}
