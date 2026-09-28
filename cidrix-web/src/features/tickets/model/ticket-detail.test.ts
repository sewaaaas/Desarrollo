import { describe, expect, it } from 'vitest'
import type { AuthUser } from '@/features/auth/model/auth.types'
import {
  availableStatusTransitions,
  canEditTicket,
  canWriteActivity,
  safeTicketsReturnTarget,
} from '@/features/tickets/model/ticket-detail'
import type { Ticket } from '@/features/tickets/model/ticket.types'

const user = (role: AuthUser['role'], id = role.toLowerCase()): AuthUser => ({
  avatarUrl: null,
  email: `${id}@cidrix.test`,
  fullName: id,
  id,
  organizationId: 'org-1',
  role,
})

const ticket = (status: Ticket['status'] = 'OPEN', assignedToId: string | null = 'tech'): Ticket => ({
  assignedTo: assignedToId ? { avatarUrl: null, fullName: 'Tech', id: assignedToId } : null,
  category: null,
  closedAt: null,
  createdAt: '2026-09-27T10:00:00.000Z',
  createdBy: { avatarUrl: null, fullName: 'User', id: 'user' },
  description: 'Descripción suficientemente detallada.',
  firstResponseAt: null,
  id: 'ticket-1',
  priority: 'MEDIUM',
  resolvedAt: null,
  status,
  ticketNumber: 'TKT-0001',
  title: 'Ticket',
  updatedAt: '2026-09-27T10:00:00.000Z',
  version: 1,
})

describe('ticket detail permissions', () => {
  it('limita edición y actividad del técnico al ticket asignado', () => {
    expect(canEditTicket(ticket(), user('TECHNICIAN', 'tech'))).toBe(true)
    expect(canEditTicket(ticket(), user('TECHNICIAN', 'other'))).toBe(false)
    expect(canWriteActivity(ticket(), user('TECHNICIAN', 'other'))).toBe(false)
  })

  it('bloquea mutaciones en estados terminales', () => {
    expect(canEditTicket(ticket('CLOSED'), user('ADMIN'))).toBe(false)
    expect(canWriteActivity(ticket('CANCELLED'), user('USER'))).toBe(false)
    expect(availableStatusTransitions(ticket('CLOSED'), user('ADMIN'))).toEqual([])
  })

  it('aplica transiciones por rol y requisito de asignación', () => {
    expect(availableStatusTransitions(ticket('RESOLVED'), user('TECHNICIAN', 'tech'))).toEqual(['IN_PROGRESS'])
    expect(availableStatusTransitions(ticket('OPEN', null), user('ADMIN'))).toEqual(['CANCELLED'])
    expect(availableStatusTransitions(ticket('OPEN'), user('USER'))).toEqual([])
  })

  it('acepta solo destinos internos de Tickets', () => {
    expect(safeTicketsReturnTarget('/tickets?status=OPEN&page=2')).toBe('/tickets?status=OPEN&page=2')
    expect(safeTicketsReturnTarget('https://evil.example')).toBe('/tickets')
    expect(safeTicketsReturnTarget('//evil.example/tickets')).toBe('/tickets')
  })
})
