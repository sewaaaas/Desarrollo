import type {
  DashboardPeriod,
  DashboardTrendItem,
  DashboardTrends,
} from '@/features/dashboard/model/dashboard.types'
import {
  formatUtcCalendarDate,
  getTrendLabelIndexes,
  getTrendMaximum,
  hasTrendActivity,
} from '@/features/dashboard/model/dashboard.utils'
import { Card } from '@/shared/components/Card'

const WIDTH = 900
const HEIGHT = 280
const PADDING_X = 48
const PADDING_TOP = 24
const PADDING_BOTTOM = 46

function periodDays(period: DashboardPeriod): number {
  return Number.parseInt(period, 10)
}

function pointCoordinates(
  series: DashboardTrendItem[],
  maximum: number,
  selector: (item: DashboardTrendItem) => number,
): string {
  const chartWidth = WIDTH - PADDING_X * 2
  const chartHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM
  return series
    .map((item, index) => {
      const x =
        series.length <= 1
          ? WIDTH / 2
          : PADDING_X + (index / (series.length - 1)) * chartWidth
      const y = PADDING_TOP + (1 - selector(item) / maximum) * chartHeight
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

export function TrendsChart({ trends }: { trends: DashboardTrends }) {
  const maximum = getTrendMaximum(trends.series)
  const labelIndexes = getTrendLabelIndexes(trends.series.length)
  const activity = hasTrendActivity(trends.series)
  const createdTotal = trends.series.reduce((total, item) => total + item.created, 0)
  const closedTotal = trends.series.reduce((total, item) => total + item.closed, 0)

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            Tendencia — Tickets creados vs cerrados
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">
            Fechas calendario en UTC · {formatUtcCalendarDate(trends.dateFrom)} a{' '}
            {formatUtcCalendarDate(trends.dateTo)}
          </p>
        </div>
        <div aria-label="Leyenda" className="flex flex-wrap gap-4 text-sm">
          <span className="inline-flex items-center gap-2 text-foreground-muted">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-primary" />
            Creados ({createdTotal})
          </span>
          <span className="inline-flex items-center gap-2 text-foreground-muted">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-success" />
            Cerrados ({closedTotal})
          </span>
        </div>
      </div>

      <div className="mt-5 min-w-0 overflow-hidden">
        <svg
          aria-label={`Tendencia de tickets creados y cerrados en los últimos ${periodDays(trends.period)} días`}
          className="h-auto w-full"
          role="img"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        >
          {[0, 0.5, 1].map((ratio) => {
            const y = PADDING_TOP + ratio * (HEIGHT - PADDING_TOP - PADDING_BOTTOM)
            const value = Math.round(maximum * (1 - ratio))
            return (
              <g key={ratio}>
                <line
                  stroke="var(--cidrix-color-border)"
                  strokeDasharray="4 6"
                  x1={PADDING_X}
                  x2={WIDTH - PADDING_X}
                  y1={y}
                  y2={y}
                />
                <text
                  fill="var(--cidrix-color-foreground-muted)"
                  fontSize="11"
                  textAnchor="end"
                  x={PADDING_X - 10}
                  y={y + 4}
                >
                  {value}
                </text>
              </g>
            )
          })}

          {trends.series.length > 0 ? (
            <>
              <polyline
                fill="none"
                points={pointCoordinates(trends.series, maximum, (item) => item.created)}
                stroke="var(--cidrix-color-primary)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
              />
              <polyline
                fill="none"
                points={pointCoordinates(trends.series, maximum, (item) => item.closed)}
                stroke="var(--cidrix-color-success)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
              />
            </>
          ) : null}

          {labelIndexes.map((index) => {
            const item = trends.series[index]
            if (!item) return null
            const x =
              trends.series.length <= 1
                ? WIDTH / 2
                : PADDING_X +
                  (index / (trends.series.length - 1)) * (WIDTH - PADDING_X * 2)
            return (
              <text
                fill="var(--cidrix-color-foreground-muted)"
                fontSize="11"
                key={item.date}
                textAnchor={index === 0 ? 'start' : index === trends.series.length - 1 ? 'end' : 'middle'}
                x={x}
                y={HEIGHT - 14}
              >
                {formatUtcCalendarDate(item.date)}
              </text>
            )
          })}
        </svg>
      </div>

      {!activity ? (
        <p className="mt-2 text-center text-sm text-foreground-muted">
          Sin actividad en este período.
        </p>
      ) : null}

      <div className="sr-only">
        <p>Datos diarios de tickets creados y cerrados, zona horaria UTC</p>
        <ul>
          {trends.series.map((item) => (
            <li key={item.date}>
              {formatUtcCalendarDate(item.date)}: {item.created} creados, {item.closed} cerrados
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
