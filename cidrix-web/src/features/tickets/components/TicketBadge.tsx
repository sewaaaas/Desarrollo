import {
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
} from '@/features/tickets/model/ticket.constants'
import type {
  TicketPriority,
  TicketStatus,
} from '@/features/tickets/model/ticket.types'

const statusClasses: Record<TicketStatus, string> = {
  OPEN: 'bg-primary/10 text-primary',
  IN_PROGRESS: 'border border-primary/30 bg-primary/5 text-primary',
  PENDING: 'bg-surface-muted text-foreground-muted',
  RESOLVED: 'bg-success/10 text-success',
  CLOSED: 'bg-surface-muted text-foreground',
  CANCELLED: 'bg-danger/10 text-danger',
}

const priorityClasses: Record<TicketPriority, string> = {
  LOW: 'bg-surface-muted text-foreground-muted',
  MEDIUM: 'bg-primary/10 text-primary',
  HIGH: 'border border-danger/30 bg-danger/5 text-danger',
  CRITICAL: 'bg-danger text-white',
}

const baseClasses =
  'inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold'

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={`${baseClasses} ${statusClasses[status]}`}>
      {TICKET_STATUS_LABELS[status]}
    </span>
  )
}

export function TicketPriorityBadge({
  priority,
}: {
  priority: TicketPriority
}) {
  return (
    <span className={`${baseClasses} ${priorityClasses[priority]}`}>
      {TICKET_PRIORITY_LABELS[priority]}
    </span>
  )
}
