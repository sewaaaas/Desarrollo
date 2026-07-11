/**
 * Contratos de eventos de dominio de CIDRIX.
 *
 * Reglas de arquitectura:
 * - Todo evento DEBE incluir organizationId (multi-tenant).
 * - Todo evento DEBE incluir occurredAt (auditoría y replay).
 * - Los productores solo importan estas interfaces — nunca módulos consumidores.
 *
 * Estado: interfaces definidas en BE-01.
 *         EventEmitter2 wiring en BE-11.
 *         Handlers agregados por sprint de feature.
 */

export interface BaseDomainEvent {
  organizationId: string;
  occurredAt: Date;
}

// ---------------------------------------------------------------------------
// Ticket Events
// ---------------------------------------------------------------------------

export interface TicketCreatedEvent extends BaseDomainEvent {
  ticketId: string;
  ticketNumber: string;
  priority: string;
  categoryId: string | null;
  createdBy: string;
  assignedTo: string | null;
  slaPolicyId: string | null;
}

export interface TicketAssignedEvent extends BaseDomainEvent {
  ticketId: string;
  assignedTo: string;
  assignedBy: string;
  previousAssignee: string | null;
}

export interface TicketStatusChangedEvent extends BaseDomainEvent {
  ticketId: string;
  from: string;
  to: string;
  changedBy: string;
}

export interface TicketClosedEvent extends BaseDomainEvent {
  ticketId: string;
  resolvedBy: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Comment Events
// ---------------------------------------------------------------------------

export interface CommentAddedEvent extends BaseDomainEvent {
  commentId: string;
  ticketId: string;
  authorId: string;
  isInternal: boolean;
}

// ---------------------------------------------------------------------------
// SLA Events
// ---------------------------------------------------------------------------

export interface SlaWarningEvent extends BaseDomainEvent {
  ticketId: string;
  assignedTo: string | null;
  dueAt: Date;
  remainingMs: number;
  type: 'response' | 'resolution';
}

export interface SlaBreachedEvent extends BaseDomainEvent {
  ticketId: string;
  assignedTo: string | null;
  breachedAt: Date;
  type: 'response' | 'resolution';
}

// ---------------------------------------------------------------------------
// User Events
// ---------------------------------------------------------------------------

export interface UserCreatedEvent extends BaseDomainEvent {
  userId: string;
  email: string;
  role: string;
  createdBy: string;
}

export interface UserRoleChangedEvent extends BaseDomainEvent {
  userId: string;
  from: string;
  to: string;
  changedBy: string;
}

// ---------------------------------------------------------------------------
// Nombres de eventos — fuente única de verdad, sin magic strings
// ---------------------------------------------------------------------------

export const EVENTS = {
  TICKET_CREATED: 'ticket.created',
  TICKET_ASSIGNED: 'ticket.assigned',
  TICKET_STATUS_CHANGED: 'ticket.status.changed',
  TICKET_CLOSED: 'ticket.closed',
  COMMENT_ADDED: 'comment.added',
  SLA_WARNING: 'sla.warning',
  SLA_BREACHED: 'sla.breached',
  USER_CREATED: 'user.created',
  USER_ROLE_CHANGED: 'user.role.changed',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];