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
import type {
  DashboardOverview,
  DashboardPeriod,
  DashboardTrends,
} from '@/features/dashboard/model/dashboard.types'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'
import type { ApiClient } from '@/shared/services/api/api-client'

const overview: DashboardOverview = {
  summary: {
    total: 21,
    byStatus: {
      OPEN: 2,
      IN_PROGRESS: 3,
      PENDING: 4,
      RESOLVED: 5,
      CLOSED: 6,
      CANCELLED: 1,
    },
  },
  byPriority: { LOW: 5, MEDIUM: 6, HIGH: 7, CRITICAL: 3 },
  byCategory: [{
    categoryId: 'cat-1',
    categoryName: 'Hardware',
    isActive: true,
    isDeleted: false,
    count: 8,
  }],
  assigneeWorkload: {
    activeStatuses: ['OPEN', 'IN_PROGRESS', 'PENDING'],
    unassignedTickets: 4,
    assignees: [{
      assigneeId: 'tech-1',
      assigneeName: 'Técnico Uno',
      role: 'TECHNICIAN',
      status: 'ACTIVE',
      activeTickets: 5,
      byStatus: { OPEN: 1, IN_PROGRESS: 2, PENDING: 2 },
    }],
  },
  resolutionTime: {
    resolutionSampleCount: 8,
    averageResolutionSeconds: 8_100,
    closureSampleCount: 2,
    averageClosureSeconds: 100_800,
  },
}

function trends(period: DashboardPeriod = '30d'): DashboardTrends {
  const days = Number.parseInt(period, 10)
  return {
    period,
    timezone: 'UTC',
    dateFrom: '2026-09-01',
    dateTo: '2026-09-30',
    series: Array.from({ length: days }, (_, index) => ({
      date: `2026-09-${String(index + 1).padStart(2, '0')}`,
      created: index === 0 ? 2 : 0,
      closed: index === 1 ? 1 : 0,
    })),
  }
}

function userFor(role: UserRole): AuthUser {
  return {
    avatarUrl: null,
    email: `${role.toLowerCase()}@cidrix.test`,
    fullName: `${role} CIDRIX`,
    id: `user-${role}`,
    organizationId: 'org-1',
    role,
  }
}

function LocationState() {
  const location = useLocation()
  return <output aria-label="URL actual">{`${location.pathname}${location.search}`}</output>
}

function defaultRequest(path: string): Promise<unknown> {
  if (path === 'dashboard/overview') return Promise.resolve(overview)
  const match = /^dashboard\/trends\?period=(7d|30d|90d)$/.exec(path)
  if (match) return Promise.resolve(trends(match[1] as DashboardPeriod))
  return Promise.reject(new Error(`Ruta inesperada: ${path}`))
}

function renderPage(
  role: UserRole = 'ADMIN',
  path = '/dashboard?period=30d',
  implementation: (path: string, options?: { signal?: AbortSignal }) => Promise<unknown> = defaultRequest,
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
          <DashboardPage />
          <LocationState />
        </MemoryRouter>
      </AuthenticatedApiContext.Provider>
    </AuthContext.Provider>,
  )

  return { request }
}

describe('DashboardPage', () => {
  it('muestra loading independiente para Overview y Trends', () => {
    renderPage('ADMIN', '/dashboard?period=30d', () => new Promise(() => undefined))

    expect(screen.getAllByRole('status').length).toBeGreaterThan(1)
    expect(screen.getByRole('status', { name: 'Cargando tendencia' })).toBeVisible()
  })

  it.each(['ADMIN', 'TECHNICIAN'] as const)(
    'muestra las métricas organizacionales para %s',
    async (role) => {
      renderPage(role)

      expect(await screen.findByRole('region', { name: 'Resumen de tickets' })).toBeVisible()
      expect(screen.getByText('Hardware')).toBeVisible()
      expect(screen.getAllByText('Técnico Uno')).not.toHaveLength(0)
      expect(screen.getByText('2 h 15 min')).toBeVisible()
      expect(screen.getByRole('img', { name: /últimos 30 días/ })).toBeVisible()
    },
  )

  it('mantiene Trends cuando Overview falla y reintenta solo Overview', async () => {
    let overviewAttempts = 0
    const { request } = renderPage('ADMIN', '/dashboard?period=30d', (path) => {
      if (path === 'dashboard/overview') {
        overviewAttempts += 1
        return overviewAttempts === 1 ? Promise.reject(new Error('fallo')) : Promise.resolve(overview)
      }
      return defaultRequest(path)
    })

    expect(await screen.findByRole('img', { name: /últimos 30 días/ })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'No se pudieron cargar las métricas' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('region', { name: 'Resumen de tickets' })).toBeVisible()
    expect(request.mock.calls.filter(([path]) => path === 'dashboard/overview')).toHaveLength(2)
    expect(request.mock.calls.filter(([path]) => String(path).startsWith('dashboard/trends'))).toHaveLength(1)
  })

  it('mantiene Overview cuando Trends falla y reintenta solo Trends', async () => {
    let trendsAttempts = 0
    const { request } = renderPage('TECHNICIAN', '/dashboard?period=30d', (path) => {
      if (String(path).startsWith('dashboard/trends')) {
        trendsAttempts += 1
        return trendsAttempts === 1 ? Promise.reject(new Error('fallo')) : Promise.resolve(trends('30d'))
      }
      return defaultRequest(path)
    })

    expect(await screen.findByRole('region', { name: 'Resumen de tickets' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'No se pudo cargar la tendencia' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('img', { name: /últimos 30 días/ })).toBeVisible()
    expect(request.mock.calls.filter(([path]) => String(path).startsWith('dashboard/trends'))).toHaveLength(2)
    expect(request.mock.calls.filter(([path]) => path === 'dashboard/overview')).toHaveLength(1)
  })

  it.each(['7d', '30d', '90d'] as const)('carga el período %s desde la URL', async (period) => {
    const { request } = renderPage('ADMIN', `/dashboard?period=${period}`)
    expect(await screen.findByRole('img', { name: new RegExp(`últimos ${Number.parseInt(period, 10)} días`) })).toBeVisible()
    expect(request).toHaveBeenCalledWith(`dashboard/trends?period=${period}`, expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('normaliza query inválida a 30d', async () => {
    const { request } = renderPage('ADMIN', '/dashboard?period=abc')
    await screen.findByRole('img', { name: /últimos 30 días/ })

    await waitFor(() => expect(screen.getByLabelText('URL actual')).toHaveTextContent('/dashboard?period=30d'))
    expect(request).toHaveBeenCalledWith('dashboard/trends?period=30d', expect.anything())
  })

  it('cambiar período actualiza solo Trends', async () => {
    const { request } = renderPage()
    await screen.findByRole('img', { name: /últimos 30 días/ })

    fireEvent.click(screen.getByRole('button', { name: '7 días' }))
    expect(await screen.findByRole('img', { name: /últimos 7 días/ })).toBeVisible()

    expect(request.mock.calls.filter(([path]) => path === 'dashboard/overview')).toHaveLength(1)
    expect(request.mock.calls.filter(([path]) => String(path).startsWith('dashboard/trends'))).toHaveLength(2)
  })

  it('aborta la tendencia anterior y una respuesta lenta no pisa el período actual', async () => {
    let firstSignal: AbortSignal | undefined
    let resolveSeven: ((value: unknown) => void) | undefined
    const sevenPending = new Promise((resolve) => { resolveSeven = resolve })
    const { request } = renderPage('ADMIN', '/dashboard?period=7d', (path, options) => {
      if (path === 'dashboard/overview') return Promise.resolve(overview)
      if (path === 'dashboard/trends?period=7d') {
        firstSignal = options?.signal
        return sevenPending
      }
      if (path === 'dashboard/trends?period=90d') return Promise.resolve(trends('90d'))
      return defaultRequest(path)
    })

    await waitFor(() => expect(request).toHaveBeenCalledWith('dashboard/trends?period=7d', expect.anything()))
    fireEvent.click(screen.getByRole('button', { name: '90 días' }))
    expect(await screen.findByRole('img', { name: /últimos 90 días/ })).toBeVisible()
    expect(firstSignal?.aborted).toBe(true)

    resolveSeven?.(trends('7d'))
    await Promise.resolve()
    expect(screen.getByRole('img', { name: /últimos 90 días/ })).toBeVisible()
  })

  it('Actualizar refresca Overview y el período vigente una sola vez', async () => {
    const { request } = renderPage()
    await screen.findByRole('img', { name: /últimos 30 días/ })
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))

    await waitFor(() => {
      expect(request.mock.calls.filter(([path]) => path === 'dashboard/overview')).toHaveLength(2)
      expect(request.mock.calls.filter(([path]) => path === 'dashboard/trends?period=30d')).toHaveLength(2)
    })
  })

  it('muestra empty states y no convierte promedios null en cero', async () => {
    const emptyOverview: DashboardOverview = {
      ...overview,
      summary: { total: 0, byStatus: { OPEN: 0, IN_PROGRESS: 0, PENDING: 0, RESOLVED: 0, CLOSED: 0, CANCELLED: 0 } },
      byPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
      byCategory: [],
      assigneeWorkload: { activeStatuses: ['OPEN', 'IN_PROGRESS', 'PENDING'], unassignedTickets: 0, assignees: [] },
      resolutionTime: { resolutionSampleCount: 0, averageResolutionSeconds: null, closureSampleCount: 0, averageClosureSeconds: null },
    }
    renderPage('ADMIN', '/dashboard?period=30d', (path) =>
      path === 'dashboard/overview'
        ? Promise.resolve(emptyOverview)
        : Promise.resolve({ ...trends('30d'), series: trends('30d').series.map((item) => ({ ...item, created: 0, closed: 0 })) }),
    )

    expect(await screen.findByText('Aún no hay tickets por categoría.')).toBeVisible()
    expect(screen.getByText('No hay tickets activos asignados.')).toBeVisible()
    expect(screen.getAllByText('Sin datos')).toHaveLength(2)
    expect(screen.queryByText('0 s')).not.toBeInTheDocument()
    expect(screen.getByText('Sin actividad en este período.')).toBeVisible()
  })
})
