import {
  DASHBOARD_PERIODS,
  DEFAULT_DASHBOARD_PERIOD,
} from '@/features/dashboard/model/dashboard.constants'
import type {
  DashboardOverview,
  DashboardPeriod,
  DashboardTrendItem,
} from '@/features/dashboard/model/dashboard.types'

export function isDashboardPeriod(value: string | null): value is DashboardPeriod {
  return DASHBOARD_PERIODS.some((period) => period.value === value)
}

export function readDashboardPeriod(searchParams: URLSearchParams): DashboardPeriod {
  const value = searchParams.get('period')
  return isDashboardPeriod(value) ? value : DEFAULT_DASHBOARD_PERIOD
}

export function dashboardPeriodToSearchParams(period: DashboardPeriod): URLSearchParams {
  const params = new URLSearchParams()
  params.set('period', period)
  return params
}

export function countActiveTickets(overview: DashboardOverview): number {
  const { byStatus } = overview.summary
  return byStatus.OPEN + byStatus.IN_PROGRESS + byStatus.PENDING
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return 'Sin datos'

  const safeSeconds = Math.max(0, Math.round(seconds))
  if (safeSeconds < 60) return `${safeSeconds} s`

  const minutes = Math.round(safeSeconds / 60)
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours} h ${remainingMinutes} min` : `${hours} h`
  }

  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours > 0 ? `${days} d ${remainingHours} h` : `${days} d`
}

export function formatUtcCalendarDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return date

  const [, , month, day] = match
  const monthLabels = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
  ] as const
  const monthLabel = monthLabels[Number(month) - 1]
  return monthLabel ? `${Number(day)} ${monthLabel}` : date
}

export function getTrendMaximum(series: DashboardTrendItem[]): number {
  const maximum = series.reduce(
    (current, item) => Math.max(current, item.created, item.closed),
    0,
  )
  return Math.max(maximum, 1)
}

export function getTrendLabelIndexes(length: number, maximumLabels = 6): number[] {
  if (length <= 0) return []
  if (length <= Math.max(maximumLabels, 7)) {
    return Array.from({ length }, (_, index) => index)
  }

  const lastIndex = length - 1
  const indexes = new Set<number>()
  for (let position = 0; position < maximumLabels; position += 1) {
    indexes.add(Math.round((position * lastIndex) / (maximumLabels - 1)))
  }
  return [...indexes].sort((left, right) => left - right)
}

export function hasTrendActivity(series: DashboardTrendItem[]): boolean {
  return series.some((item) => item.created > 0 || item.closed > 0)
}
