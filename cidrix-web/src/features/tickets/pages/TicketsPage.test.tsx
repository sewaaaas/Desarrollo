import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import {
  AuthContext,
  AuthenticatedApiContext,
} from '@/features/auth/context/auth-context'
import type {
  AuthContextValue,
  AuthUser,
  UserRole,
} from '@/features/auth/model/auth.types'
import { TicketsPage } from '@/features/tickets/pages/TicketsPage'
import type { Ticket } from '@/features/tickets/model/ticket.types'
import type { ApiClient } from '@/shared/services/api/api-client'

const ticket: Ticket = {
  id: '4b980ba5-34d7-4fe6-a2f7-430a773f5331',
  ticketNumber: 'TKT-0042',
  title: 'La impresora no responde',
  description: 'No imprime desde esta mañana.',
  status: 'OPEN',
  priority: 'HIGH',
  version: 1,
  createdBy: { id: 'user-1', fullName: 'María Pérez', avatarUrl: null },
  assignedTo: null,
  category: { id: 'category-1', name: 'Hardware', slug: 'hardware' },
  firstResponseAt: null,
  resolvedAt: null,
  closedAt: null,
  createdAt: '2026-09-24T15:00:00.000Z',
  updatedAt: '2026-09-24T15:00:00.000Z',
}

function userFor(role: UserRole): AuthUser {
  return {
    id: `user-${role}`,
    email: `${role.toLowerCase()}@cidrix.test`,
    fullName: `${role} CIDRIX`,
    organizationId: 'org-1',
    role,
    avatarUrl: null,
  }
}

function LocationState() {
  const location = useLocation()
  return <output aria-label="URL actual">{`${location.pathname}${location.search}`}</output>
}

function defaultRequest(requestPath: string) {
    if (requestPath.startsWith('tickets?')) {
      return Promise.resolve({
        data: [ticket],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      })
    }
    if (requestPath.startsWith('categories?')) {
      return Promise.resolve({
        data: [{ id: 'category-1', name: 'Hardware', slug: 'hardware', isActive: true }],
        meta: { total: 1, page: 1, limit: 100, totalPages: 1 },
      })
    }
    if (requestPath.startsWith('users?')) {
      return Promise.resolve({
        data: [{ id: 'tech-1', fullName: 'Técnico Uno', role: 'TECHNICIAN', status: 'ACTIVE' }],
        meta: { total: 1, page: 1, limit: 100, totalPages: 1 },
      })
    }
    if (requestPath === 'tickets') return Promise.resolve(ticket)
    return Promise.reject(new Error('Ruta inesperada'))
}

function renderPage(
  role: UserRole,
  path = '/tickets',
  implementation: (requestPath: string) => Promise<unknown> = defaultRequest,
) {
  const request = vi.fn().mockImplementation(implementation)
  const apiClient: ApiClient = { request }
  const authValue: AuthContextValue = {
    login: vi.fn(),
    logout: vi.fn(),
    retryInitialization: vi.fn(),
    state: { status: 'authenticated', user: userFor(role) },
  }

  render(
    <AuthContext.Provider value={authValue}>
      <AuthenticatedApiContext.Provider value={apiClient}>
        <MemoryRouter initialEntries={[path]}>
          <TicketsPage />
          <LocationState />
        </MemoryRouter>
      </AuthenticatedApiContext.Provider>
    </AuthContext.Provider>,
  )

  return { request }
}

describe('TicketsPage', () => {
  it('carga el listado con filtros de URL y muestra los datos', async () => {
    const { request } = renderPage(
      'TECHNICIAN',
      '/tickets?status=OPEN&priority=HIGH&page=1',
    )

    expect(await screen.findAllByText('TKT-0042')).not.toHaveLength(0)
    expect(screen.getAllByText('La impresora no responde')).not.toHaveLength(0)
    expect(request).toHaveBeenCalledWith(
      'tickets?status=OPEN&priority=HIGH&sortBy=createdAt&sortOrder=desc&page=1&limit=20',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('persiste filtros en URL y reinicia la página', async () => {
    renderPage('USER', '/tickets?page=3')
    await screen.findAllByText('TKT-0042')

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'PENDING' } })

    await waitFor(() => {
      expect(screen.getByLabelText('URL actual')).toHaveTextContent('/tickets?status=PENDING')
    })
  })

  it('USER no consulta opciones ni ve campos prohibidos al crear', async () => {
    const { request } = renderPage('USER')
    await screen.findAllByText('TKT-0042')

    expect(request.mock.calls.some(([path]) => String(path).startsWith('categories?'))).toBe(false)
    expect(request.mock.calls.some(([path]) => String(path).startsWith('users?'))).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo ticket' }))
    expect(screen.queryByLabelText(/Categoría/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Asignar a/)).not.toBeInTheDocument()
  })

  it('ADMIN carga categorías y usuarios para filtros y alta', async () => {
    const { request } = renderPage('ADMIN')

    expect(await screen.findAllByRole('option', { name: 'Técnico Uno' })).not.toHaveLength(0)
    expect(screen.getByRole('option', { name: 'Hardware' })).toBeInTheDocument()
    expect(request.mock.calls.some(([path]) => String(path).startsWith('users?'))).toBe(true)
    expect(request.mock.calls.some(([path]) => String(path).startsWith('categories?'))).toBe(true)
  })

  it('valida el formulario y refresca después de crear', async () => {
    const { request } = renderPage('USER')
    await screen.findAllByText('TKT-0042')
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo ticket' }))

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Nuevo problema' } })
    fireEvent.change(screen.getByLabelText(/^Descripción/), { target: { value: 'corta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear ticket' }))
    expect(await screen.findByText('La descripción debe tener al menos 10 caracteres.')).toBeVisible()

    fireEvent.change(screen.getByLabelText(/^Descripción/), {
      target: { value: 'Descripción suficientemente detallada' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear ticket' }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Crear ticket' })).not.toBeInTheDocument()
    })
    expect(screen.getByText('TKT-0042 se creó correctamente.')).toBeInTheDocument()
    expect(request).toHaveBeenCalledWith('tickets', {
      json: {
        title: 'Nuevo problema',
        description: 'Descripción suficientemente detallada',
        priority: 'MEDIUM',
      },
      method: 'POST',
    })
    await waitFor(() => {
      expect(request.mock.calls.filter(([path]) => String(path).startsWith('tickets?'))).toHaveLength(2)
    })
  })

  it('mantiene un estado de carga visible', () => {
    renderPage('USER', '/tickets', () => new Promise(() => undefined))

    expect(screen.getByRole('status', { name: 'Cargando tickets' })).toBeVisible()
  })

  it('distingue el vacío inicial del vacío con filtros', async () => {
    const empty = (requestPath: string) => {
      if (requestPath.startsWith('tickets?')) {
        return Promise.resolve({
          data: [],
          meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
        })
      }
      return defaultRequest(requestPath)
    }

    const first = renderPage('USER', '/tickets', empty)
    expect(await screen.findByRole('heading', { name: 'Aún no hay tickets' })).toBeVisible()
    first.request.mockClear()
  })

  it('muestra vacío filtrado y permite limpiar filtros', async () => {
    const empty = (requestPath: string) =>
      requestPath.startsWith('tickets?')
        ? Promise.resolve({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } })
        : defaultRequest(requestPath)
    renderPage('USER', '/tickets?status=CLOSED', empty)

    expect(await screen.findByRole('heading', { name: 'No encontramos resultados' })).toBeVisible()
    fireEvent.click(screen.getAllByRole('button', { name: 'Limpiar filtros' })[0]!)
    await waitFor(() => expect(screen.getByLabelText('URL actual')).toHaveTextContent('/tickets'))
  })

  it('muestra error y reintenta el listado', async () => {
    let attempts = 0
    const request = (requestPath: string) => {
      if (requestPath.startsWith('tickets?')) {
        attempts += 1
        if (attempts === 1) return Promise.reject(new Error('fallo'))
      }
      return defaultRequest(requestPath)
    }
    renderPage('USER', '/tickets', request)

    expect(await screen.findByRole('heading', { name: 'No se pudo cargar el listado' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findAllByText('TKT-0042')).not.toHaveLength(0)
    expect(attempts).toBe(2)
  })

  it('aplica búsqueda, prioridad, orden y paginación contra backend', async () => {
    const { request } = renderPage('ADMIN')
    await screen.findAllByText('TKT-0042')

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'correo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    fireEvent.change(screen.getByLabelText('Prioridad'), { target: { value: 'CRITICAL' } })
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'category-1' } })
    fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'number' } })
    fireEvent.change(screen.getByLabelText('Dirección'), { target: { value: 'asc' } })
    fireEvent.change(await screen.findByLabelText(/Por página/), {
      target: { value: '50' },
    })

    await waitFor(() => {
      expect(screen.getByLabelText('URL actual')).toHaveTextContent(
        '/tickets?search=correo&priority=CRITICAL&categoryId=category-1&sortBy=number&sortOrder=asc&limit=50',
      )
    })
    expect(request.mock.calls.some(([path]) => String(path).includes('limit=50'))).toBe(true)
  })

  it('navega al placeholder de detalle conservando el retorno', async () => {
    renderPage('USER', '/tickets?status=OPEN')
    const links = await screen.findAllByRole('link', { name: 'TKT-0042' })
    fireEvent.click(links[0]!)

    expect(screen.getByLabelText('URL actual')).toHaveTextContent(
      '/tickets/4b980ba5-34d7-4fe6-a2f7-430a773f5331',
    )
  })

  it('navega entre páginas usando la meta del backend', async () => {
    const paginated = (requestPath: string) =>
      requestPath.startsWith('tickets?')
        ? Promise.resolve({
            data: [ticket],
            meta: { total: 60, page: 2, limit: 20, totalPages: 3 },
          })
        : defaultRequest(requestPath)
    renderPage('USER', '/tickets?page=2', paginated)
    await screen.findAllByText('TKT-0042')

    expect(screen.getByText(/Página 2 de 3/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))

    await waitFor(() => {
      expect(screen.getByLabelText('URL actual')).toHaveTextContent('/tickets')
    })
  })
})
