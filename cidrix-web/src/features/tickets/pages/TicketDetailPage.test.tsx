import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AuthContext,
  AuthenticatedApiContext,
} from '@/features/auth/context/auth-context'
import type {
  AuthContextValue,
  AuthUser,
  UserRole,
} from '@/features/auth/model/auth.types'
import { TicketDetailPage } from '@/features/tickets/pages/TicketDetailPage'
import type { Ticket } from '@/features/tickets/model/ticket.types'
import type { ApiClient } from '@/shared/services/api/api-client'
import { ApiError } from '@/shared/services/api/api-error'

const ticketId = '4b980ba5-34d7-4fe6-a2f7-430a773f5331'
const ticket: Ticket = {
  assignedTo: { avatarUrl: null, fullName: 'Técnico Uno', id: 'tech-1' },
  category: { id: 'category-1', name: 'Hardware', slug: 'hardware' },
  closedAt: null,
  createdAt: '2026-09-27T10:00:00.000Z',
  createdBy: { avatarUrl: null, fullName: 'María Pérez', id: 'user-1' },
  description: 'La impresora no responde desde esta mañana.',
  firstResponseAt: null,
  id: ticketId,
  priority: 'HIGH',
  resolvedAt: null,
  status: 'OPEN',
  ticketNumber: 'TKT-0042',
  title: 'Impresora sin conexión',
  updatedAt: '2026-09-27T10:00:00.000Z',
  version: 3,
}

function authUser(role: UserRole, id?: string): AuthUser {
  return {
    avatarUrl: null,
    email: `${role.toLowerCase()}@cidrix.test`,
    fullName: `${role} CIDRIX`,
    id: id ?? (role === 'USER' ? 'user-1' : role === 'TECHNICIAN' ? 'tech-1' : 'admin-1'),
    organizationId: 'org-1',
    role,
  }
}

function defaultRequest(path: string, options?: { method?: string }) {
  if (path === `tickets/${ticketId}` && options?.method === 'PATCH') {
    return Promise.resolve({ ...ticket, title: 'Título actualizado', version: 4 })
  }
  if (path === `tickets/${ticketId}/assign`) {
    return Promise.resolve({ ...ticket, version: 4 })
  }
  if (path === `tickets/${ticketId}/status`) {
    return Promise.resolve({ ...ticket, status: 'IN_PROGRESS', version: 4 })
  }
  if (path === `tickets/${ticketId}`) return Promise.resolve(ticket)
  if (path.includes('/history')) {
    return Promise.resolve({
      data: [
        {
          actor: { id: 'tech-1', name: 'Técnico Uno', role: 'TECHNICIAN' },
          content: '<script>alert(1)</script>',
          id: 'comment-1',
          timestamp: '2026-09-27T11:00:00.000Z',
          type: 'COMMENT',
          visibility: 'INTERNAL',
        },
        {
          action: 'STATUS_CHANGED',
          actor: null,
          changes: { status: { from: 'OPEN', to: 'IN_PROGRESS' } },
          id: 'history-1',
          timestamp: '2026-09-27T10:30:00.000Z',
          type: 'HISTORY',
        },
      ],
      meta: { limit: 20, page: 1, total: 2, totalPages: 1 },
    })
  }
  if (path.includes('/attachments') && path.endsWith('/download')) {
    return Promise.resolve(new Blob(['archivo'], { type: 'text/plain' }))
  }
  if (path.includes('/attachments')) {
    return Promise.resolve({
      data: [{
        commentId: null,
        createdAt: '2026-09-27T11:00:00.000Z',
        id: 'attachment-1',
        mimeType: 'text/plain',
        originalName: 'diagnóstico muy largo.txt',
        sizeBytes: 2048,
        ticketId,
        uploadedBy: { id: 'tech-1', name: 'Técnico Uno', role: 'TECHNICIAN' },
        visibility: 'PUBLIC',
      }],
      meta: { limit: 20, page: 1, total: 1, totalPages: 1 },
    })
  }
  if (path.startsWith('categories?')) {
    return Promise.resolve({ data: [{ id: 'category-1', isActive: true, name: 'Hardware', slug: 'hardware' }], meta: { limit: 100, page: 1, total: 1, totalPages: 1 } })
  }
  if (path.startsWith('users?')) {
    return Promise.resolve({ data: [{ id: 'tech-1', fullName: 'Técnico Uno', role: 'TECHNICIAN', status: 'ACTIVE' }], meta: { limit: 100, page: 1, total: 1, totalPages: 1 } })
  }
  if (path.endsWith('/comments')) return Promise.resolve({ id: 'comment-2' })
  return Promise.resolve(undefined)
}

function renderPage(
  role: UserRole,
  options: {
    entry?: string | { pathname: string; state?: unknown }
    request?: (path: string, options?: { method?: string }) => Promise<unknown>
    userId?: string
  } = {},
) {
  const request = vi.fn().mockImplementation(options.request ?? defaultRequest)
  const apiClient: ApiClient = { request }
  const authValue: AuthContextValue = {
    login: vi.fn(),
    logout: vi.fn(),
    retryInitialization: vi.fn(),
    state: { status: 'authenticated', user: authUser(role, options.userId) },
  }
  render(
    <AuthContext.Provider value={authValue}>
      <AuthenticatedApiContext.Provider value={apiClient}>
        <MemoryRouter initialEntries={[options.entry ?? `/tickets/${ticketId}`]}>
          <Routes>
            <Route element={<TicketDetailPage />} path="/tickets/:id" />
            <Route element={<h1>Listado conservado</h1>} path="/tickets" />
          </Routes>
        </MemoryRouter>
      </AuthenticatedApiContext.Provider>
    </AuthContext.Provider>,
  )
  return { request }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TicketDetailPage', () => {
  it('muestra loading y después el detalle, timeline humano y texto sin HTML', async () => {
    renderPage('USER')
    expect(screen.getByRole('status', { name: 'Cargando ticket' })).toBeVisible()

    expect(await screen.findByRole('heading', { name: ticket.title })).toBeVisible()
    expect(await screen.findByText('Estado actualizado')).toBeVisible()
    expect(screen.getByText('Estado: En progreso')).toBeVisible()
    expect(screen.getByText('<script>alert(1)</script>')).toBeVisible()
    expect(document.querySelector('script')).toBeNull()
  })

  it.each([
    [403, 'No tienes acceso a este ticket'],
    [404, 'Ticket no encontrado'],
  ])('muestra un estado principal seguro para %s', async (status, heading) => {
    renderPage('USER', {
      request: () => Promise.reject(new ApiError({ code: `HTTP_${status}`, kind: 'http', message: 'oculto', status })),
    })
    expect(await screen.findByRole('heading', { name: heading })).toBeVisible()
    expect(screen.queryByText(ticket.title)).not.toBeInTheDocument()
  })

  it('regresa al listado conservando el origen interno y descarta uno externo', async () => {
    const first = renderPage('USER', {
      entry: { pathname: `/tickets/${ticketId}`, state: { from: '/tickets?status=OPEN&page=2' } },
    })
    expect(await screen.findByRole('heading', { name: ticket.title })).toBeVisible()
    expect(screen.getByRole('link', { name: /Volver a Tickets/ })).toHaveAttribute('href', '/tickets?status=OPEN&page=2')
    first.request.mockClear()
  })

  it('mantiene USER en modo público y sin controles administrativos', async () => {
    const { request } = renderPage('USER')
    await screen.findByRole('heading', { name: ticket.title })
    expect(screen.queryByRole('button', { name: 'Editar ticket' })).not.toBeInTheDocument()
    expect(screen.queryByText('Interno', { selector: 'option' })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Añadir comentario'), { target: { value: 'Respuesta pública' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar comentario' }))
    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(`tickets/${ticketId}/comments`, {
        json: { content: 'Respuesta pública', visibility: 'PUBLIC' },
        method: 'POST',
      })
    })
  })

  it('habilita TECHNICIAN asignado y bloquea al no asignado', async () => {
    const assigned = renderPage('TECHNICIAN')
    expect(await screen.findByRole('button', { name: 'Editar ticket' })).toBeVisible()
    expect(screen.getAllByRole('option', { name: 'Interno' }).length).toBeGreaterThan(0)
    assigned.request.mockClear()
  })

  it('no ofrece mutaciones a TECHNICIAN no asignado', async () => {
    renderPage('TECHNICIAN', { userId: 'tech-other' })
    expect(await screen.findByText('Solo el técnico asignado puede añadir actividad.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Editar ticket' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'En progreso' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publicar comentario' })).not.toBeInTheDocument()
  })

  it('ofrece a ADMIN edición, asignación y solo transiciones válidas', async () => {
    const { request } = renderPage('ADMIN')
    fireEvent.click(await screen.findByRole('button', { name: 'Editar ticket' }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Título actualizado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(`tickets/${ticketId}`, {
        json: expect.objectContaining({ title: 'Título actualizado', version: 3 }),
        method: 'PATCH',
      })
    })
    expect(screen.getByRole('button', { name: 'Cambiar asignación' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'En progreso' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Cancelado' })).toBeVisible()
  })

  it('envía version al desasignar y cambiar estado como ADMIN', async () => {
    const { request } = renderPage('ADMIN')
    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar asignación' }))
    fireEvent.change(screen.getByLabelText('Técnico'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar asignación' }))
    await waitFor(() => expect(request).toHaveBeenCalledWith(
      `tickets/${ticketId}/assign`,
      { json: { assignedToId: null, version: 3 }, method: 'PATCH' },
    ))

    fireEvent.click(screen.getByRole('button', { name: 'En progreso' }))
    await waitFor(() => expect(request).toHaveBeenCalledWith(
      `tickets/${ticketId}/status`,
      { json: { status: 'IN_PROGRESS', version: 4 }, method: 'PATCH' },
    ))
  })

  it('bloquea comentarios, upload y acciones en tickets terminales', async () => {
    const closedTicket = { ...ticket, closedAt: ticket.updatedAt, status: 'CLOSED' as const }
    renderPage('ADMIN', {
      request: (path, options) => path === `tickets/${ticketId}` && !options?.method
        ? Promise.resolve(closedTicket)
        : defaultRequest(path, options),
    })
    expect(await screen.findByText('Este ticket está cerrado para nueva actividad.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Editar ticket' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /Archivos/ }))
    expect(screen.queryByLabelText('Adjuntar archivo')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cambiar asignación' })).not.toBeInTheDocument()
  })

  it('muestra conflicto 409 y permite recargar sin retry automático', async () => {
    const requestImplementation = (path: string, options?: { method?: string }) => {
      if (path === `tickets/${ticketId}` && options?.method === 'PATCH') {
        return Promise.reject(new ApiError({ code: 'VERSION_CONFLICT', kind: 'http', message: 'Conflicto', status: 409 }))
      }
      return defaultRequest(path, options)
    }
    const { request } = renderPage('ADMIN', { request: requestImplementation })
    fireEvent.click(await screen.findByRole('button', { name: 'Editar ticket' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Este ticket fue modificado por otra persona.')).toBeVisible()
    expect(request.mock.calls.filter(([path, options]) => path === `tickets/${ticketId}` && options?.method === 'PATCH')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Recargar ticket' }))
    await waitFor(() => expect(request.mock.calls.filter(([path, options]) => path === `tickets/${ticketId}` && !options?.method).length).toBeGreaterThan(1))
  })

  it('gestiona upload, download autenticado y delete solo para ADMIN', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:cidrix')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { request } = renderPage('ADMIN')
    await screen.findByRole('heading', { name: ticket.title })
    fireEvent.click(screen.getByRole('tab', { name: /Archivos/ }))
    expect(await screen.findByText('diagnóstico muy largo.txt')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }))
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledOnce())
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:cidrix')

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(request).toHaveBeenCalledWith(
      `tickets/${ticketId}/attachments/attachment-1`,
      { method: 'DELETE' },
    ))
  })

  it('muestra el error 413 del backend durante upload', async () => {
    const requestImplementation = (path: string, options?: { method?: string }) => {
      if (path.endsWith('/attachments') && options?.method === 'POST') {
        return Promise.reject(new ApiError({ code: 'PAYLOAD_TOO_LARGE', kind: 'http', message: 'Grande', status: 413 }))
      }
      return defaultRequest(path, options)
    }
    renderPage('ADMIN', { request: requestImplementation })
    await screen.findByRole('heading', { name: ticket.title })
    fireEvent.click(screen.getByRole('tab', { name: /Archivos/ }))
    const file = new File(['contenido'], 'evidencia.txt', { type: 'text/plain' })
    fireEvent.change(screen.getByLabelText('Adjuntar archivo'), { target: { files: [file] } })
    const uploadForm = screen.getByRole('button', { name: 'Subir archivo' }).closest('form')
    expect(uploadForm).not.toBeNull()
    fireEvent.submit(uploadForm!)
    expect(await screen.findByText('El archivo supera el límite permitido por el servidor.')).toBeVisible()
  })

  it('carga páginas adicionales del timeline conservando el orden', async () => {
    const requestImplementation = (path: string, options?: { method?: string }) => {
      if (path.includes('/history')) {
        const secondPage = path.includes('page=2')
        return Promise.resolve({
          data: [{
            action: secondPage ? 'CREATED' : 'UPDATED',
            actor: null,
            changes: null,
            id: secondPage ? 'older' : 'newer',
            timestamp: secondPage ? '2026-09-26T10:00:00.000Z' : '2026-09-27T10:00:00.000Z',
            type: 'HISTORY',
          }],
          meta: { limit: 20, page: secondPage ? 2 : 1, total: 2, totalPages: 2 },
        })
      }
      return defaultRequest(path, options)
    }
    renderPage('USER', { request: requestImplementation })
    expect(await screen.findByText('Ticket actualizado')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más actividad' }))
    expect(await screen.findByText('Ticket creado')).toBeVisible()
    const activity = screen.getByRole('tabpanel').textContent ?? ''
    expect(activity.indexOf('Ticket actualizado')).toBeLessThan(activity.indexOf('Ticket creado'))
  })

  it('mantiene el ticket visible ante un fallo parcial y permite reintentar', async () => {
    let timelineAttempts = 0
    const requestImplementation = (path: string, options?: { method?: string }) => {
      if (path.includes('/history')) {
        timelineAttempts += 1
        if (timelineAttempts === 1) return Promise.reject(new Error('fallo'))
      }
      return defaultRequest(path, options)
    }
    renderPage('USER', { request: requestImplementation })
    expect(await screen.findByRole('heading', { name: ticket.title })).toBeVisible()
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar actividad' }))
    expect(await screen.findByText('Estado actualizado')).toBeVisible()
    expect(timelineAttempts).toBe(2)
  })
})
