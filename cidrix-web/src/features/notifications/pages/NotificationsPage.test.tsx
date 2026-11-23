import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, AuthenticatedApiContext } from '@/features/auth/context/auth-context'
import type { AuthContextValue, UserRole } from '@/features/auth/model/auth.types'
import type { ApiClient, ApiRequestOptions } from '@/shared/services/api/api-client'
import { ApiError } from '@/shared/services/api/api-error'
import { NotificationsUnreadProvider } from '../context/NotificationsUnreadProvider'
import { UnreadBadge } from '../components/UnreadBadge'
import type { NotificationItem, PaginatedNotifications } from '../model/notification.types'
import { NotificationsPage } from './NotificationsPage'

const item: NotificationItem = {
  id: 'notification-1', type: 'TICKET_ASSIGNED', title: 'Ticket asignado',
  message: 'Se te asignó el ticket TKT-0042', ticketId: 'ticket-1', ticketNumber: 'TKT-0042',
  isRead: false, readAt: null, createdAt: '2026-10-10T15:00:00.000Z',
}

function list(data: NotificationItem[] = [item], page = 1, total = data.length): PaginatedNotifications {
  return { data, meta: { page, limit: 20, total, totalPages: Math.ceil(total / 20) } }
}

function defaultRequest(path: string): Promise<unknown> {
  if (path === 'notifications/unread-count') return Promise.resolve({ count: 1 })
  if (path.startsWith('notifications?')) return Promise.resolve(list())
  if (path === 'notifications/read-all') return Promise.resolve({ updatedCount: 1 })
  if (path.endsWith('/read')) return Promise.resolve({ ...item, isRead: true })
  return Promise.reject(new Error(`Ruta inesperada: ${path}`))
}

function LocationProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  return <><output aria-label="URL actual">{location.pathname}{location.search}</output><button onClick={() => void navigate(-1)}>Atrás</button><button onClick={() => void navigate(1)}>Adelante</button></>
}

function renderPage(
  implementation: (path: string, options?: ApiRequestOptions) => Promise<unknown> = defaultRequest,
  path = '/notifications?filter=all&page=1',
  role: UserRole = 'USER',
) {
  const request = vi.fn().mockImplementation(implementation)
  const api: ApiClient = { request }
  const auth: AuthContextValue = {
    login: vi.fn(), logout: vi.fn(), retryInitialization: vi.fn(),
    state: { status: 'authenticated', user: { id: `user-${role}`, organizationId: 'org', role, fullName: role, email: `${role}@test.dev`, avatarUrl: null } },
  }
  const view = render(
    <AuthContext.Provider value={auth}><AuthenticatedApiContext.Provider value={api}>
      <NotificationsUnreadProvider><MemoryRouter initialEntries={[path]}><UnreadBadge /><LocationProbe />
        <Routes><Route path="/notifications" element={<NotificationsPage />} /><Route path="/tickets/:id" element={<h1>Detalle del ticket</h1>} /></Routes>
      </MemoryRouter></NotificationsUnreadProvider>
    </AuthenticatedApiContext.Provider></AuthContext.Provider>,
  )
  return { request, ...view }
}

const listCalls = (request: ReturnType<typeof vi.fn>) => request.mock.calls.filter(([path]) => String(path).startsWith('notifications?'))

describe('NotificationsPage', () => {
  it('distingue loading de listado y count', () => {
    renderPage(() => new Promise(() => undefined))
    expect(screen.getByRole('status', { name: 'Cargando notificaciones' })).toBeVisible()
    expect(screen.getByText('Actualizando conteo de no leídas…')).toBeVisible()
  })

  it.each(['ADMIN', 'TECHNICIAN', 'USER'] as const)('carga lista y count propios para %s sin parámetros de identidad', async (role) => {
    const { request } = renderPage(defaultRequest, undefined, role)
    expect(await screen.findByText('Ticket asignado')).toBeVisible()
    expect(screen.getByText('No leída')).toBeVisible()
    expect(screen.getByLabelText('1 notificaciones sin leer')).toBeVisible()
    expect(listCalls(request)).toHaveLength(1)
    expect(request.mock.calls.some(([path]) => /userId|organizationId/.test(String(path)))).toBe(false)
  })

  it.each([['Todas', 'all', ''], ['No leídas', 'unread', '&isRead=false'], ['Leídas', 'read', '&isRead=true']] as const)('aplica filtro %s y reinicia página', async (label, filter, suffix) => {
    const { request } = renderPage((path) => path.startsWith('notifications?') ? Promise.resolve(list([item], 2, 40)) : defaultRequest(path), '/notifications?filter=all&page=2')
    await screen.findByText('Ticket asignado')
    fireEvent.click(screen.getByRole('button', { name: label }))
    await waitFor(() => expect(request).toHaveBeenCalledWith(`notifications?page=1&limit=20${suffix}`, expect.anything()))
    expect(screen.getByLabelText('URL actual')).toHaveTextContent(`filter=${filter}&page=1`)
  })

  it('normaliza URL inválida y evita GET duplicado al normalizar', async () => {
    const { request } = renderPage(defaultRequest, '/notifications?filter=abc&page=-1')
    await screen.findByText('Ticket asignado')
    expect(screen.getByLabelText('URL actual')).toHaveTextContent('filter=all&page=1')
    expect(listCalls(request)).toHaveLength(1)
  })

  it('paginación y back/forward conservan el estado URL', async () => {
    const { request } = renderPage((path) => path.startsWith('notifications?')
      ? Promise.resolve(list([item], Number(new URLSearchParams(path.split('?')[1]).get('page')), 40)) : defaultRequest(path))
    await screen.findByText('Ticket asignado')
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await screen.findByText('Página 2 de 2 · 40 notificaciones')
    fireEvent.click(screen.getByText('Atrás'))
    await screen.findByText('Página 1 de 2 · 40 notificaciones')
    fireEvent.click(screen.getByText('Adelante'))
    await screen.findByText('Página 2 de 2 · 40 notificaciones')
    expect(listCalls(request)).toHaveLength(4)
  })

  it.each([['all', 'No tienes notificaciones.'], ['unread', 'No tienes notificaciones sin leer.'], ['read', 'No tienes notificaciones leídas.']] as const)('muestra empty state %s', async (filter, message) => {
    renderPage((path) => path.startsWith('notifications?') ? Promise.resolve(list([])) : defaultRequest(path), `/notifications?filter=${filter}&page=1`)
    expect(await screen.findByText(message)).toBeVisible()
  })

  it('marca una con un solo PATCH y sincroniza listado, count y badge', async () => {
    let marked = false
    const { request } = renderPage((path, options) => {
      if (options?.method === 'PATCH') { marked = true; return Promise.resolve({ ...item, isRead: true }) }
      if (path === 'notifications/unread-count') return Promise.resolve({ count: marked ? 0 : 1 })
      if (path.startsWith('notifications?')) return Promise.resolve(list(marked ? [] : [item]))
      return defaultRequest(path)
    }, '/notifications?filter=unread&page=1')
    await screen.findByText('Ticket asignado')
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como leída TKT-0042' }))
    expect(await screen.findByText('No tienes notificaciones sin leer.')).toBeVisible()
    expect(screen.queryByLabelText('1 notificaciones sin leer')).not.toBeInTheDocument()
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(1)
  })

  it.each([1, 0])('mark all trata updatedCount=%s como éxito y refresca count a cero', async (updatedCount) => {
    let marked = false
    const { request } = renderPage((path) => {
      if (path === 'notifications/read-all') { marked = true; return Promise.resolve({ updatedCount }) }
      if (path === 'notifications/unread-count') return Promise.resolve({ count: marked ? 0 : 1 })
      if (path.startsWith('notifications?')) return Promise.resolve(list(marked ? [] : [item]))
      return defaultRequest(path)
    }, '/notifications?filter=unread&page=1')
    await screen.findByText('Ticket asignado')
    fireEvent.click(screen.getByRole('button', { name: 'Marcar todas como leídas' }))
    expect(await screen.findByText(`Se marcaron ${updatedCount} notificaciones como leídas.`)).toBeVisible()
    await screen.findByText('No tienes notificaciones sin leer.')
    expect(screen.getByRole('button', { name: 'Marcar todas como leídas' })).toBeDisabled()
    expect(request.mock.calls.filter(([path]) => path === 'notifications/read-all')).toHaveLength(1)
  })

  it('una mutación corrige página fuera del nuevo rango', async () => {
    let marked = false
    renderPage((path, options) => {
      if (options?.method === 'PATCH') { marked = true; return Promise.resolve({ ...item, isRead: true }) }
      if (path.startsWith('notifications?')) {
        const page = Number(new URLSearchParams(path.split('?')[1]).get('page'))
        return Promise.resolve(list(marked && page === 2 ? [] : [item], page, marked ? 20 : 21))
      }
      return defaultRequest(path)
    }, '/notifications?filter=unread&page=2')
    await screen.findByText('Ticket asignado')
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como leída TKT-0042' }))
    await waitFor(() => expect(screen.getByLabelText('URL actual')).toHaveTextContent('filter=unread&page=1'))
  })

  it('un fallo de listado conserva count y permite retry independiente', async () => {
    let attempts = 0
    const { request } = renderPage((path) => {
      if (path.startsWith('notifications?') && attempts++ === 0) return Promise.reject(new Error('list'))
      return defaultRequest(path)
    })
    await screen.findByRole('heading', { name: 'No se pudieron cargar las notificaciones' })
    expect(screen.getByLabelText('1 notificaciones sin leer')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar listado' }))
    await screen.findByText('Ticket asignado')
    expect(request.mock.calls.filter(([path]) => path === 'notifications/unread-count')).toHaveLength(1)
  })

  it('un fallo de count conserva listado, oculta badge y permite reintento', async () => {
    let attempts = 0
    const { request } = renderPage((path) => {
      if (path === 'notifications/unread-count' && attempts++ === 0) return Promise.reject(new Error('count'))
      return defaultRequest(path)
    })
    await screen.findByText('Ticket asignado')
    expect(screen.queryByLabelText(/notificaciones sin leer/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Marcar todas como leídas' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar conteo' }))
    await screen.findByLabelText('1 notificaciones sin leer')
    expect(listCalls(request)).toHaveLength(1)
  })

  it.each([
    [new ApiError({ kind: 'network', code: 'NET', message: 'interno' }), 'No pudimos conectar con el servidor.'],
    [new ApiError({ kind: 'http', status: 500, code: 'SERVER', message: 'interno' }), 'El servicio no está disponible temporalmente.'],
    [new ApiError({ kind: 'http', status: 403, code: 'DENIED', message: 'interno' }), 'No tienes permiso para realizar esta acción.'],
  ])('muestra error seguro sin exponer mensaje técnico', async (error, message) => {
    renderPage((path) => path.startsWith('notifications?') ? Promise.reject(error) : defaultRequest(path))
    expect(await screen.findByText(message as string)).toBeVisible()
    expect(screen.queryByText('interno')).not.toBeInTheDocument()
  })

  it('404 markRead muestra mensaje seguro, refresca y no impide abrir ticket', async () => {
    const { request } = renderPage((path, options) => options?.method === 'PATCH'
      ? Promise.reject(new ApiError({ kind: 'http', status: 404, code: 'NOT_FOUND', message: 'interno' })) : defaultRequest(path))
    await screen.findByText('Ticket asignado')
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como leída TKT-0042' }))
    expect(await screen.findByText('La notificación ya no está disponible.')).toBeVisible()
    await waitFor(() => expect(listCalls(request)).toHaveLength(2))
    fireEvent.click(screen.getByRole('link', { name: 'Ver ticket TKT-0042' }))
    expect(await screen.findByRole('heading', { name: 'Detalle del ticket' })).toBeVisible()
    expect(screen.getByLabelText('URL actual')).toHaveTextContent('/tickets/ticket-1')
  })

  it('Ver ticket usa ticketId y no marca ni enriquece el ticket', async () => {
    const { request } = renderPage()
    await screen.findByText('Ticket asignado')
    fireEvent.click(screen.getByRole('link', { name: 'Ver ticket TKT-0042' }))
    await screen.findByRole('heading', { name: 'Detalle del ticket' })
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(0)
    expect(request.mock.calls.filter(([path]) => String(path).startsWith('tickets'))).toHaveLength(0)
  })

  it('refresh conserva filtro/página y consulta listado+count una vez', async () => {
    const { request } = renderPage(defaultRequest, '/notifications?filter=unread&page=1')
    await screen.findByText('Ticket asignado')
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    await waitFor(() => expect(listCalls(request)).toHaveLength(2))
    expect(request.mock.calls.filter(([path]) => path === 'notifications/unread-count')).toHaveLength(2)
    expect(screen.getByLabelText('URL actual')).toHaveTextContent('filter=unread&page=1')
  })

  it('ignora una respuesta vieja tras cambiar rápidamente de filtro', async () => {
    let resolveOld: (value: unknown) => void = () => undefined
    const pending = new Promise((resolve) => { resolveOld = resolve })
    const { request } = renderPage((path) => path === 'notifications?page=1&limit=20' ? pending : defaultRequest(path))
    fireEvent.click(screen.getByRole('button', { name: 'No leídas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Leídas' }))
    await screen.findByText('Ticket asignado')
    expect((listCalls(request)[0]?.[1].signal as AbortSignal).aborted).toBe(true)
    await act(async () => resolveOld(list([{ ...item, title: 'Respuesta vieja' }])))
    expect(screen.queryByText('Respuesta vieja')).not.toBeInTheDocument()
    expect(screen.getByLabelText('URL actual')).toHaveTextContent('filter=read&page=1')
  })

  it('aborta GETs al desmontar', () => {
    const { request, unmount } = renderPage(() => new Promise(() => undefined))
    const signals = request.mock.calls.map(([, options]) => options.signal as AbortSignal)
    unmount()
    expect(signals.every((signal) => signal.aborted)).toBe(true)
  })

  it('ignora una página pendiente al volver atrás', async () => {
    let resolvePage: (value: unknown) => void = () => undefined
    const pending = new Promise((resolve) => { resolvePage = resolve })
    const { request } = renderPage((path) => {
      if (path === 'notifications?page=2&limit=20') return pending
      if (path.startsWith('notifications?')) return Promise.resolve(list([item], 1, 40))
      return defaultRequest(path)
    })
    await screen.findByText('Ticket asignado')
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(listCalls(request)).toHaveLength(2))
    fireEvent.click(screen.getByText('Atrás'))
    await screen.findByText('Página 1 de 2 · 40 notificaciones')
    expect((listCalls(request)[1]?.[1].signal as AbortSignal).aborted).toBe(true)
    await act(async () => resolvePage(list([{ ...item, title: 'Página obsoleta' }], 2, 40)))
    expect(screen.queryByText('Página obsoleta')).not.toBeInTheDocument()
  })

  it('conserva datos durante refresh e ignora ese refresh al cambiar filtro', async () => {
    let attempts = 0
    let resolveRefresh: (value: unknown) => void = () => undefined
    const pending = new Promise((resolve) => { resolveRefresh = resolve })
    const { request } = renderPage((path) => {
      if (path === 'notifications?page=1&limit=20' && attempts++ > 0) return pending
      if (path.endsWith('isRead=true')) return Promise.resolve(list([{ ...item, title: 'Resultado vigente', isRead: true }]))
      return defaultRequest(path)
    })
    await screen.findByText('Ticket asignado')
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(screen.getByText('Ticket asignado')).toBeVisible()
    expect(screen.getByText('Actualizando notificaciones…')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Leídas' }))
    await screen.findByText('Resultado vigente')
    await act(async () => resolveRefresh(list([{ ...item, title: 'Refresh obsoleto' }])))
    expect(screen.queryByText('Refresh obsoleto')).not.toBeInTheDocument()
    expect((listCalls(request)[1]?.[1].signal as AbortSignal).aborted).toBe(true)
  })

  it('bloquea doble lectura masiva mientras el PATCH está pendiente', async () => {
    const { request, unmount } = renderPage((path) => path === 'notifications/read-all' ? new Promise(() => undefined) : defaultRequest(path))
    await screen.findByText('Ticket asignado')
    const button = screen.getByRole('button', { name: 'Marcar todas como leídas' })
    fireEvent.click(button)
    fireEvent.click(button)
    const patches = request.mock.calls.filter(([path]) => path === 'notifications/read-all')
    expect(patches).toHaveLength(1)
    unmount()
    expect((patches[0]?.[1].signal as AbortSignal).aborted).toBe(true)
  })

  it('conserva título y mensaje largos como texto sin truncar datos', async () => {
    const title = 'Notificación extensa '.repeat(30)
    const message = 'detalle-sin-espacios-'.repeat(80)
    renderPage((path) => path.startsWith('notifications?') ? Promise.resolve(list([{ ...item, title, message }])) : defaultRequest(path))
    expect(await screen.findByRole('heading', { name: title.trim().replace(/\s+/g, ' ') })).toBeVisible()
    expect(screen.getByText(message)).toBeVisible()
  })

  it('bloquea doble PATCH y aborta mutación al desmontar', async () => {
    const { request, unmount } = renderPage((path, options) => options?.method === 'PATCH' ? new Promise(() => undefined) : defaultRequest(path))
    await screen.findByText('Ticket asignado')
    const button = screen.getByRole('button', { name: 'Marcar como leída TKT-0042' })
    fireEvent.click(button)
    fireEvent.click(button)
    const patches = request.mock.calls.filter(([, options]) => options?.method === 'PATCH')
    expect(patches).toHaveLength(1)
    unmount()
    expect((patches[0]?.[1].signal as AbortSignal).aborted).toBe(true)
  })

  it('renderiza script literalmente sin insertar HTML', async () => {
    const payload = '<script>alert(1)</script>'
    const { container } = renderPage((path) => path.startsWith('notifications?') ? Promise.resolve(list([{ ...item, title: payload, message: payload }])) : defaultRequest(path))
    expect(await screen.findAllByText(payload)).toHaveLength(2)
    expect(container.querySelector('script')).toBeNull()
  })
})
