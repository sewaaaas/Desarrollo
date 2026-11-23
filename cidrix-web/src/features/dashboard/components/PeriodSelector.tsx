import { DASHBOARD_PERIODS } from '@/features/dashboard/model/dashboard.constants'
import type { DashboardPeriod } from '@/features/dashboard/model/dashboard.types'

interface PeriodSelectorProps {
  onChange: (period: DashboardPeriod) => void
  value: DashboardPeriod
}

export function PeriodSelector({ onChange, value }: PeriodSelectorProps) {
  return (
    <div
      aria-label="Período de la tendencia"
      className="inline-flex rounded-control border border-border bg-surface p-1"
      role="group"
    >
      {DASHBOARD_PERIODS.map((period) => (
        <button
          aria-pressed={period.value === value}
          className={`min-h-9 rounded-md px-3 text-sm font-semibold transition-colors ${
            period.value === value
              ? 'bg-primary text-white'
              : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground'
          }`}
          key={period.value}
          onClick={() => onChange(period.value)}
          type="button"
        >
          {period.label}
        </button>
      ))}
    </div>
  )
}
