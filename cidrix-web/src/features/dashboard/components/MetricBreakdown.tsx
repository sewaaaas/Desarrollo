import type { ReactNode } from 'react'
import { Card } from '@/shared/components/Card'

export interface MetricBreakdownItem {
  label: string
  value: number
}

interface MetricBreakdownProps {
  items: MetricBreakdownItem[]
  title: string
  footer?: ReactNode
}

export function MetricBreakdown({ items, title, footer }: MetricBreakdownProps) {
  const maximum = Math.max(...items.map((item) => item.value), 1)

  return (
    <Card>
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <ul className="mt-5 space-y-4">
        {items.map((item) => (
          <li key={item.label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-foreground">{item.label}</span>
              <span className="tabular-nums text-foreground-muted">{item.value}</span>
            </div>
            <div
              aria-label={`${item.label}: ${item.value}`}
              aria-valuemax={maximum}
              aria-valuemin={0}
              aria-valuenow={item.value}
              className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted"
              role="progressbar"
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(item.value / maximum) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      {footer}
    </Card>
  )
}
