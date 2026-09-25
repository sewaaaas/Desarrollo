import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '@/app/router/AppRoutes'
import { AuthContext } from '@/features/auth/context/auth-context'
import type {
  AuthContextValue,
  AuthState,
  AuthUser,
  UserRole,
} from '@/features/auth/model/auth.types'

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
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthContext.Provider>,
  )

  return contextValue
}

describe('AppRoutes', () => {
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

  it('restaura un destino interno con path, query y hash', () => {
    renderRoute(
      '/login',
      { status: 'authenticated', user: createUser('USER') },
      { from: '/tickets/ticket-42?tab=history#comment-2' },
    )

    expect(
      screen.getByRole('heading', { name: 'Detalle del ticket' }),
    ).toBeVisible()
    expect(screen.getByText('ticket-42')).toBeVisible()
  })

  it('descarta un destino externo y usa una ruta segura', () => {
    renderRoute(
      '/login',
      { status: 'authenticated', user: createUser('ADMIN') },
      { from: 'https://evil.example/phishing' },
    )

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  it('impide que USER permanezca en Dashboard', () => {
    renderRoute('/dashboard', {
      status: 'authenticated',
      user: createUser('USER'),
    })

    expect(screen.getByRole('heading', { name: 'Tickets' })).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Dashboard' }),
    ).not.toBeInTheDocument()
  })

  it('resuelve una ruta dinámica de ticket sin loops', () => {
    renderRoute('/tickets/4b980ba5-34d7-4fe6-a2f7-430a773f5331', {
      status: 'authenticated',
      user: createUser('TECHNICIAN'),
    })

    expect(
      screen.getByRole('heading', { name: 'Detalle del ticket' }),
    ).toBeVisible()
    expect(
      screen.getByText('4b980ba5-34d7-4fe6-a2f7-430a773f5331'),
    ).toBeVisible()
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
