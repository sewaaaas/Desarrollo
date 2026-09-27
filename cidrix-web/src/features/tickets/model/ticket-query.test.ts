import { describe, expect, it } from 'vitest'
import {
  readTicketFilters,
  ticketFiltersToSearchParams,
} from '@/features/tickets/model/ticket-query'

describe('ticket query state', () => {
  it('usa defaults seguros ante parámetros inválidos', () => {
    const filters = readTicketFilters(
      new URLSearchParams('status=INVALID&page=-2&limit=500&sortBy=bad'),
    )

    expect(filters).toMatchObject({
      limit: 20,
      page: 1,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      status: undefined,
    })
  })

  it('preserva filtros válidos para refresh y navegación', () => {
    const filters = readTicketFilters(
      new URLSearchParams(
        'search=correo&status=PENDING&priority=HIGH&sortBy=number&sortOrder=asc&page=3&limit=50',
      ),
    )

    expect(ticketFiltersToSearchParams(filters).toString()).toBe(
      'search=correo&status=PENDING&priority=HIGH&sortBy=number&sortOrder=asc&page=3&limit=50',
    )
  })

  it('omite defaults y valores vacíos de la URL visible', () => {
    const filters = readTicketFilters(new URLSearchParams())

    expect(ticketFiltersToSearchParams(filters).toString()).toBe('')
  })
})
