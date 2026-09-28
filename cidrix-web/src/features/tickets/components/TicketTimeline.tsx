import type { TimelineItem } from '@/features/tickets/model/ticket.types'
import {
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
} from '@/features/tickets/model/ticket.constants'
import { Button } from '@/shared/components/Button'

const dateFormatter = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const ACTION_LABELS = {
  CREATED: 'Ticket creado',
  UPDATED: 'Ticket actualizado',
  ASSIGNED: 'Técnico asignado',
  UNASSIGNED: 'Técnico desasignado',
  STATUS_CHANGED: 'Estado actualizado',
  CANCELLED: 'Ticket cancelado',
  CLOSED: 'Ticket cerrado',
  FIRST_RESPONSE: 'Primera respuesta registrada',
} as const

const FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  description: 'Descripción',
  priority: 'Prioridad',
  status: 'Estado',
  firstResponseAt: 'Primera respuesta',
  assignedToId: 'Técnico',
  categoryId: 'Categoría',
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : dateFormatter.format(date)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function formatKnownValue(field: string, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return 'Sin valor'
  if (field === 'status' && typeof value === 'string' && value in TICKET_STATUS_LABELS) {
    return TICKET_STATUS_LABELS[value as keyof typeof TICKET_STATUS_LABELS]
  }
  if (field === 'priority' && typeof value === 'string' && value in TICKET_PRIORITY_LABELS) {
    return TICKET_PRIORITY_LABELS[value as keyof typeof TICKET_PRIORITY_LABELS]
  }
  if (field === 'firstResponseAt' && typeof value === 'string') return formatDate(value)
  if (field === 'description') return 'Contenido actualizado'
  if (field === 'assignedToId' || field === 'categoryId') return 'Actualizado'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return null
}

function describeChanges(changes: unknown): string[] {
  if (!isRecord(changes)) return []
  const descriptions: string[] = []

  for (const [field, change] of Object.entries(changes)) {
    const label = FIELD_LABELS[field]
    if (!label) continue
    if (isRecord(change) && Object.hasOwn(change, 'to')) {
      const value = formatKnownValue(field, change.to)
      descriptions.push(value ? `${label}: ${value}` : `${label} actualizado`)
    } else {
      const value = formatKnownValue(field, change)
      descriptions.push(value ? `${label}: ${value}` : `${label} actualizado`)
    }
  }

  if (descriptions.length === 0 && Object.keys(changes).length > 0) {
    return ['Información del ticket actualizada']
  }
  return descriptions
}

interface TicketTimelineProps {
  error: string | null
  items: TimelineItem[]
  loading: boolean
  onLoadMore(): void
  onRetry(): void
  page: number
  totalPages: number
}

export function TicketTimeline({
  error,
  items,
  loading,
  onLoadMore,
  onRetry,
  page,
  totalPages,
}: TicketTimelineProps) {
  if (loading && items.length === 0) {
    return <p aria-live="polite" className="py-8 text-center text-sm text-foreground-muted">Cargando actividad…</p>
  }

  if (error && items.length === 0) {
    return (
      <div className="py-8 text-center" role="alert">
        <p className="text-sm text-danger">{error}</p>
        <Button className="mt-3" onClick={onRetry} size="sm" variant="secondary">Reintentar actividad</Button>
      </div>
    )
  }

  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-foreground-muted">Todavía no hay actividad.</p>
  }

  return (
    <div>
      <ol className="space-y-4">
        {items.map((item) => {
          const changes = item.type === 'HISTORY' ? describeChanges(item.changes) : []
          return (
            <li className="relative rounded-control border border-border p-4" key={`${item.type}-${item.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {item.type === 'COMMENT'
                      ? `${item.actor.name} comentó`
                      : ACTION_LABELS[item.action]}
                  </p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    {item.type === 'HISTORY' ? item.actor?.name ?? 'Sistema' : item.actor.role}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {item.type === 'COMMENT' && item.visibility === 'INTERNAL' ? (
                    <span className="rounded-full bg-surface-muted px-2 py-1 text-xs font-semibold text-foreground-muted">Interno</span>
                  ) : null}
                  <time className="text-xs text-foreground-muted" dateTime={item.timestamp}>{formatDate(item.timestamp)}</time>
                </div>
              </div>
              {item.type === 'COMMENT' ? (
                <p className="mt-3 whitespace-pre-wrap break-words text-sm text-foreground">{item.content}</p>
              ) : changes.length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm text-foreground-muted">
                  {changes.map((change) => <li key={change}>{change}</li>)}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ol>
      {error ? <p className="mt-4 text-sm text-danger" role="alert">{error}</p> : null}
      {page < totalPages ? (
        <Button className="mt-4 w-full" isLoading={loading} onClick={onLoadMore} variant="secondary">Cargar más actividad</Button>
      ) : null}
    </div>
  )
}
