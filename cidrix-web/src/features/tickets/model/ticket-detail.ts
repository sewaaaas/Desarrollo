import type { AuthUser, UserRole } from '@/features/auth/model/auth.types'
import type {
  Ticket,
  TicketStatus,
} from '@/features/tickets/model/ticket.types'

const TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['PENDING', 'RESOLVED', 'CANCELLED'],
  PENDING: ['IN_PROGRESS', 'CANCELLED'],
  RESOLVED: ['IN_PROGRESS', 'CLOSED'],
  CLOSED: [],
  CANCELLED: [],
}

export function isTerminalTicket(ticket: Ticket): boolean {
  return ticket.status === 'CLOSED' || ticket.status === 'CANCELLED'
}

export function isAssignedTechnician(
  ticket: Ticket,
  user: AuthUser,
): boolean {
  return user.role === 'TECHNICIAN' && ticket.assignedTo?.id === user.id
}

export function canEditTicket(ticket: Ticket, user: AuthUser): boolean {
  if (isTerminalTicket(ticket)) return false
  return user.role === 'ADMIN' || isAssignedTechnician(ticket, user)
}

export function canWriteActivity(ticket: Ticket, user: AuthUser): boolean {
  if (isTerminalTicket(ticket)) return false
  if (user.role === 'ADMIN' || user.role === 'USER') return true
  return isAssignedTechnician(ticket, user)
}

export function availableStatusTransitions(
  ticket: Ticket,
  user: AuthUser,
): TicketStatus[] {
  if (user.role === 'USER') return []
  if (user.role === 'TECHNICIAN' && !isAssignedTechnician(ticket, user)) {
    return []
  }

  return TRANSITIONS[ticket.status].filter((status) => {
    if (user.role === 'TECHNICIAN') {
      return status !== 'CANCELLED' && status !== 'CLOSED'
    }
    if (
      ['IN_PROGRESS', 'PENDING', 'RESOLVED'].includes(status) &&
      !ticket.assignedTo
    ) {
      return false
    }
    return true
  })
}

export function canUseInternalVisibility(role: UserRole): boolean {
  return role === 'ADMIN' || role === 'TECHNICIAN'
}

export function safeTicketsReturnTarget(value: unknown): string {
  if (typeof value !== 'string') return '/tickets'
  if (!value.startsWith('/tickets') || value.startsWith('//')) return '/tickets'

  try {
    const url = new URL(value, 'https://cidrix.local')
    if (url.origin !== 'https://cidrix.local') return '/tickets'
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/tickets'
  }
}
