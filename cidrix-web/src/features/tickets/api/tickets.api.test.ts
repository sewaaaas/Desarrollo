import { describe, expect, it, vi } from 'vitest'
import { createTicketsApi } from '@/features/tickets/api/tickets.api'
import type {
  CreateTicketInput,
  TicketFilters,
} from '@/features/tickets/model/ticket.types'
import type { ApiClient } from '@/shared/services/api/api-client'

const filters: TicketFilters = {
  search: 'impresora',
  status: 'OPEN',
  priority: undefined,
  categoryId: undefined,
  assignedToId: undefined,
  createdById: undefined,
  dateFrom: undefined,
  dateTo: undefined,
  sortBy: 'createdAt',
  sortOrder: 'desc',
  page: 2,
  limit: 20,
}

function setup() {
  const client: ApiClient = { request: vi.fn() }
  return { api: createTicketsApi(client), request: vi.mocked(client.request) }
}

describe('ticketsApi', () => {
  it('serializa solo filtros con valor al listar', async () => {
    const { api, request } = setup()
    request.mockResolvedValue({ data: [], meta: { total: 0, page: 2, limit: 20, totalPages: 0 } })

    await api.list(filters)

    expect(request).toHaveBeenCalledWith(
      'tickets?search=impresora&status=OPEN&sortBy=createdAt&sortOrder=desc&page=2&limit=20',
      { signal: undefined },
    )
  })

  it('crea un ticket sin añadir campos opcionales', async () => {
    const { api, request } = setup()
    const input: CreateTicketInput = {
      title: 'No imprime',
      description: 'La impresora no responde',
      priority: 'HIGH',
    }
    request.mockResolvedValue({ id: 'ticket-1' })

    await api.create(input)

    expect(request).toHaveBeenCalledWith('tickets', {
      json: input,
      method: 'POST',
    })
  })

  it('carga categorías y usuarios activos con el límite permitido', async () => {
    const { api, request } = setup()
    request.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } })

    await api.listCategories()
    await api.listActiveUsers()

    expect(request).toHaveBeenNthCalledWith(
      1,
      'categories?isActive=true&page=1&limit=100',
      { signal: undefined },
    )
    expect(request).toHaveBeenNthCalledWith(
      2,
      'users?status=ACTIVE&page=1&limit=100',
      { signal: undefined },
    )
  })

  it('envía version en las mutaciones y pagina el timeline descendente', async () => {
    const { api, request } = setup()
    request.mockResolvedValue({})

    await api.update('ticket/1', { title: 'Nuevo', version: 3 })
    await api.assign('ticket/1', { assignedToId: null, version: 4 })
    await api.updateStatus('ticket/1', { status: 'RESOLVED', version: 5 })
    await api.getTimeline('ticket/1', 2)

    expect(request).toHaveBeenNthCalledWith(1, 'tickets/ticket%2F1', {
      json: { title: 'Nuevo', version: 3 },
      method: 'PATCH',
    })
    expect(request).toHaveBeenNthCalledWith(2, 'tickets/ticket%2F1/assign', {
      json: { assignedToId: null, version: 4 },
      method: 'PATCH',
    })
    expect(request).toHaveBeenNthCalledWith(3, 'tickets/ticket%2F1/status', {
      json: { status: 'RESOLVED', version: 5 },
      method: 'PATCH',
    })
    expect(request).toHaveBeenNthCalledWith(
      4,
      'tickets/ticket%2F1/history?page=2&limit=20&order=desc',
      { signal: undefined },
    )
  })

  it('propaga errores de la fachada autenticada sin reinterpretarlos', async () => {
    const { api, request } = setup()
    const error = new Error('fallo de sesión')
    request.mockRejectedValue(error)

    await expect(api.list(filters)).rejects.toBe(error)
  })
})
