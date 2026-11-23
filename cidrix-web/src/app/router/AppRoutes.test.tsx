import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '@/app/router/AppRoutes'
import {
  AuthContext,
  AuthenticatedApiContext,
} from '@/features/auth/context/auth-context'
import type {
  AuthContextValue,
  AuthState,
  AuthUser,
  UserRole,
} from '@/features/auth/model/auth.types'
import type { ApiClient } from '@/shared/services/api/api-client'

const testApiClient: ApiClient = {
  request: vi.fn().mockImplementation((path: string) => {
    if (path === 'notifications/unread-count') {
      return Promise.resolve({ count: 0 })
    }
    if (path.startsWith('notifications?')) {
      return Promise.resolve({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      })
    }
    if (path === 'dashboard/overview') {
      return Promise.resolve({
        summary: {
          total: 0,
          byStatus: { OPEN: 0, IN_PROGRESS: 0, PENDING: 0, RESOLVED: 0, CLOSED: 0, CANCELLED: 0 },
        },
        byPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
        byCategory: [],
        assigneeWorkload: {
          activeStatuses: ['OPEN', 'IN_PROGRESS', 'PENDING'],
          unassignedTickets: 0,
          assignees: [],
        },
        resolutionTime: {
          resolutionSampleCount: 0,
          averageResolutionSeconds: null,
          closureSampleCount: 0,
          averageClosureSeconds: null,
        },
      })
    }
    if (path.startsWith('dashboard/trends?period=')) {
      const period = path.slice('dashboard/trends?period='.length) as '7d' | '30d' | '90d'
      const days = Number.parseInt(period, 10)
      return Promise.resolve({
        period,
        timezone: 'UTC',
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        series: Array.from({ length: days }, (_, index) => ({
          date: `2026-09-${String(index + 1).padStart(2, '0')}`,
          created: 0,
          closed: 0,
        })),
      })
    }
    if (path.startsWith('tickets?')) {
      return Promise.resolve({
        data: [],
        meta: { limit: 20, page: 1, total: 0, totalPages: 0 },
      })
    }
    if (path.startsWith('categories?') || path.startsWith('users?')) {
      return Promise.resolve({
        data: [],
        meta: { limit: 100, page: 1, total: 0, totalPages: 0 },
      })
    }
    if (path.includes('/history') || path.includes('/attachments')) {
      return Promise.resolve({
        data: [],
        meta: { limit: 20, page: 1, total: 0, totalPages: 0 },
      })
    }
    if (/^tickets\/[^/]+$/.test(path)) {
      const id = decodeURIComponent(path.slice('tickets/'.length))
      return Promise.resolve({
        assignedTo: null,
        category: null,
        closedAt: null,
        createdAt: '2026-09-27T10:00:00.000Z',
        createdBy: { avatarUrl: null, fullName: 'USER CIDRIX', id: 'user-USER' },
        description: 'Descripción suficientemente detallada.',
        firstResponseAt: null,
        id,
        priority: 'MEDIUM',
        resolvedAt: null,
        status: 'OPEN',
        ticketNumber: 'TKT-0042',
        title: 'Detalle cargado',
        updatedAt: '2026-09-27T10:00:00.000Z',
        version: 1,
      })
    }
    return Promise.resolve(undefined)
  }),
}

function createUser(role: UserRole): AuthUser {
  return {
    avatarUrl: null,
    email: `${role.toLowerCase()}@cidrix.test`,
    fullName: `${role} CIDRIX`,
    id: `user-${role}`,
    organizationId: 'org-1',
    role,
  }
}

function createContext(state: AuthState): AuthContextValue {
  return {
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    retryInitialization: vi.fn(),
    state,
  }
}

function renderRoute(
  path: string,
  state: AuthState,
  locationState?: unknown,
) {
  const contextValue = createContext(state)
  const initialEntry = locationState
    ? { pathname: path, state: locationState }
    : path

  render(
    <AuthContext.Provider value={contextValue}>
      <AuthenticatedApiContext.Provider value={testApiClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthenticatedApiContext.Provider>
    </AuthContext.Provider>,
  )

  return contextValue
}

describe('AppRoutes', () => {
  beforeEach(() => {
    vi.mocked(testApiClient.request).mockClear()
  })

  it.each(['ADMIN', 'TECHNICIAN', 'USER'] as const)(
    'permite Notificaciones a %s',
    async (role) => {
      renderRoute('/notifications', {
        status: 'authenticated',
        user: createUser(role),
      })

      expect(await screen.findByText('No tienes notificaciones.')).toBeVisible()
      expect(screen.getByRole('heading', { name: 'Notificaciones' })).toBeVisible()
    },
  )

  it('renderiza /login solo para una sesión anónima', () => {
    renderRoute('/login', {
      reason: 'initial',
      status: 'unauthenticated',
      user: null,
    })

    expect(
      screen.getByRole('heading', { name: 'Iniciar sesión' }),
    ).toBeVisible()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('redirige una ruta privada anónima a Login', () => {
    renderRoute('/tickets', {
      reason: 'initial',
      status: 'unauthenticated',
      user: null,
    })

    expect(
      screen.getByRole('heading', { name: 'Iniciar sesión' }),
    ).toBeVisible()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('renderiza rutas privadas para una sesión autenticada', () => {
    renderRoute('/tickets', {
      status: 'authenticated',
      user: createUser('USER'),
    })

    expect(screen.getByRole('heading', { name: 'Tickets' })).toBeVisible()
    expect(
      screen.getByRole('navigation', { name: 'Navegación principal' }),
    ).toBeVisible()
    expect(screen.getByRole('banner')).toBeVisible()
  })

  it('muestra el loader y no filtra UI durante initializing', () => {
    renderRoute('/tickets', { status: 'initializing', user: null })

    expect(
      screen.getByRole('status', { name: 'Verificando sesión' }),
    ).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Tickets' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Iniciar sesión' }),
    ).not.toBeInTheDocument()
  })

  it('muestra indisponibilidad y permite retry sin simular logout', () => {
    const context = renderRoute('/tickets', {
      error: {
        code: 'AUTH_SERVICE_UNAVAILABLE',
        kind: 'network',
        message: 'El servicio no está disponible temporalmente.',
      },
      status: 'unavailable',
      user: null,
    })

    expect(
      screen.getByRole('heading', { name: 'No pudimos conectar' }),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(context.retryInitialization).toHaveBeenCalledOnce()
  })

  it.each([
    ['ADMIN', 'Dashboard'],
    ['TECHNICIAN', 'Dashboard'],
    ['USER', 'Tickets'],
  ] as const)('redirige Login a la ruta inicial de %s', (role, heading) => {
    renderRoute('/login', {
      status: 'authenticated',
      user: createUser(role),
    })

    expect(screen.getByRole('heading', { name: heading })).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Iniciar sesión' }),
    ).not.toBeInTheDocument()
  })

  it('restaura un destino interno con path, query y hash', async () => {
    renderRoute(
      '/login',
      { status: 'authenticated', user: createUser('USER') },
      { from: '/tickets/ticket-42?tab=history#comment-2' },
    )

    expect(await screen.findByRole('heading', { name: 'Detalle cargado' })).toBeVisible()
  })

  it('descarta un destino externo y usa una ruta segura', () => {
    renderRoute(
      '/login',
      { status: 'authenticated', user: createUser('ADMIN') },
      { from: 'https://evil.example/phishing' },
    )

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  it('impide que USER permanezca en Dashboard sin solicitar métricas', () => {
    renderRoute('/dashboard', {
      status: 'authenticated',
      user: createUser('USER'),
    })

    expect(screen.getByRole('heading', { name: 'Tickets' })).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Dashboard' }),
    ).not.toBeInTheDocument()
    expect(
      vi.mocked(testApiClient.request).mock.calls.some(([path]) =>
        String(path).startsWith('dashboard/'),
      ),
    ).toBe(false)
  })

  it('resuelve una ruta dinámica de ticket sin loops', async () => {
    renderRoute('/tickets/4b980ba5-34d7-4fe6-a2f7-430a773f5331', {
      status: 'authenticated',
      user: createUser('TECHNICIAN'),
    })

    expect(await screen.findByRole('heading', { name: 'Detalle cargado' })).toBeVisible()
  })

  it('mantiene una página 404 segura para rutas desconocidas', () => {
    renderRoute('/ruta-inexistente', {
      reason: 'initial',
      status: 'unauthenticated',
      user: null,
    })

    expect(
      screen.getByRole('heading', { name: 'Página no encontrada' }),
    ).toBeVisible()
  })
})
