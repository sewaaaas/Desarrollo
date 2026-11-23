import { NOTIFICATION_FILTERS } from '../model/notification.constants'
import type { NotificationFilter } from '../model/notification.types'

export function NotificationFilters({ value, onChange, disabled }: { value: NotificationFilter; onChange: (filter: NotificationFilter) => void; disabled: boolean }) {
  return (
    <div aria-label="Filtrar notificaciones" className="flex flex-wrap gap-2" role="group">
      {NOTIFICATION_FILTERS.map((option) => (
        <button aria-pressed={value === option.value} className={`min-h-10 rounded-control px-4 text-sm font-semibold disabled:opacity-55 ${value === option.value ? 'bg-primary text-white' : 'border border-border bg-surface text-foreground-muted hover:bg-surface-muted'}`} disabled={disabled} key={option.value} onClick={() => onChange(option.value)} type="button">
          {option.label}
        </button>
      ))}
    </div>
  )
}
