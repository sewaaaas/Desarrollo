import type { DashboardOverview } from '@/features/dashboard/model/dashboard.types'
import { countActiveTickets } from '@/features/dashboard/model/dashboard.utils'
import { Card } from '@/shared/components/Card'

interface DashboardSummaryProps {
  overview: DashboardOverview
}

export function DashboardSummary({ overview }: DashboardSummaryProps) {
  const metrics = [
    { label: 'Total', value: overview.summary.total },
    { label: 'Activos', value: countActiveTickets(overview) },
    { label: 'Resueltos', value: overview.summary.byStatus.RESOLVED },
    {
      label: 'Sin asignar',
      value: overview.assigneeWorkload.unassignedTickets,
    },
  ]

  return (
    <section aria-label="Resumen de tickets" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <Card className="p-5" key={metric.label}>
          <p className="text-sm font-medium text-foreground-muted">{metric.label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            {metric.value.toLocaleString('es-PE')}
          </p>
        </Card>
      ))}
    </section>
  )
}
