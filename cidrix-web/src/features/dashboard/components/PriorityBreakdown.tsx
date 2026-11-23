import { MetricBreakdown } from '@/features/dashboard/components/MetricBreakdown'
import type { TicketPriorityCounts } from '@/features/dashboard/model/dashboard.types'
import {
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
} from '@/features/tickets/model/ticket.constants'

export function PriorityBreakdown({ counts }: { counts: TicketPriorityCounts }) {
  return (
    <MetricBreakdown
      items={TICKET_PRIORITIES.map((priority) => ({
        label: TICKET_PRIORITY_LABELS[priority],
        value: counts[priority],
      }))}
      title="Por prioridad"
    />
  )
}
