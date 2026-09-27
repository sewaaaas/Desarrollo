import type {
  TicketPriority,
  TicketSortBy,
  TicketStatus,
} from '@/features/tickets/model/ticket.types'

export const TICKET_STATUSES: readonly TicketStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'PENDING',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
]

export const TICKET_PRIORITIES: readonly TicketPriority[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
]

export const TICKET_SORT_OPTIONS: ReadonlyArray<{
  label: string
  value: TicketSortBy
}> = [
  { label: 'Más recientes', value: 'createdAt' },
  { label: 'Actualizados', value: 'updatedAt' },
  { label: 'Prioridad', value: 'priority' },
  { label: 'Estado', value: 'status' },
  { label: 'Número', value: 'number' },
]

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Abierto',
  IN_PROGRESS: 'En progreso',
  PENDING: 'Pendiente',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
  CANCELLED: 'Cancelado',
}

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
}
