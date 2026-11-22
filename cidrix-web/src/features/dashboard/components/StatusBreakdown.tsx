import { MetricBreakdown } from '@/features/dashboard/components/MetricBreakdown'
import type { TicketStatusCounts } from '@/features/dashboard/model/dashboard.types'
import {
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
} from '@/features/tickets/model/ticket.constants'

export function StatusBreakdown({ counts }: { counts: TicketStatusCounts }) {
  return (
    <MetricBreakdown
      items={TICKET_STATUSES.map((status) => ({
        label: TICKET_STATUS_LABELS[status],
        value: counts[status],
      }))}
      title="Por estado"
    />
  )
}
