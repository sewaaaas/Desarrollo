import type { DashboardPeriod } from '@/features/dashboard/model/dashboard.types'

export const DASHBOARD_PERIODS: ReadonlyArray<{
  days: number
  label: string
  value: DashboardPeriod
}> = [
  { days: 7, label: '7 días', value: '7d' },
  { days: 30, label: '30 días', value: '30d' },
  { days: 90, label: '90 días', value: '90d' },
]

export const DEFAULT_DASHBOARD_PERIOD: DashboardPeriod = '30d'

export const USER_STATUS_LABELS = {
  ACTIVE: 'Activo',
  DELETED: 'Eliminado',
  INACTIVE: 'Inactivo',
} as const
