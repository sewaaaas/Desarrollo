import type { DashboardOverview } from '@/features/dashboard/model/dashboard.types'
import { formatDuration } from '@/features/dashboard/model/dashboard.utils'
import { Card } from '@/shared/components/Card'

function sampleLabel(count: number): string {
  return `Basado en ${count} ${count === 1 ? 'ticket' : 'tickets'}`
}

export function ResolutionMetrics({
  resolutionTime,
}: {
  resolutionTime: DashboardOverview['resolutionTime']
}) {
  const metrics = [
    {
      label: 'Tiempo hasta resolución',
      sampleCount: resolutionTime.resolutionSampleCount,
      value: resolutionTime.averageResolutionSeconds,
    },
    {
      label: 'Tiempo hasta cierre',
      sampleCount: resolutionTime.closureSampleCount,
      value: resolutionTime.averageClosureSeconds,
    },
  ]

  return (
    <Card>
      <h2 className="text-lg font-bold text-foreground">Tiempos promedio</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {metrics.map((metric) => (
          <div className="rounded-control bg-surface-muted p-4" key={metric.label}>
            <p className="text-sm font-medium text-foreground-muted">{metric.label}</p>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {formatDuration(metric.value)}
            </p>
            {metric.value !== null ? (
              <p className="mt-1 text-xs text-foreground-muted">
                {sampleLabel(metric.sampleCount)}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  )
}
