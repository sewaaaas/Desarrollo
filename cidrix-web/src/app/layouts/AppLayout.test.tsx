import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppLayout } from '@/app/layouts/AppLayout'
import { AuthContext, AuthenticatedApiContext } from '@/features/auth/context/auth-context'
import type {
  AuthContextValue,
  AuthUser,
  UserRole,
} from '@/features/auth/model/auth.types'

function renderLayout(role: UserRole, count = 0, failCount = false) {
  const user: AuthUser = {
    avatarUrl: null,
    email: `${role.toLowerCase()}@cidrix.test`,
    fullName: `${role} CIDRIX`,
    id: `user-${role}`,
    organizationId: 'org-1',
    role,
  }
  const context: AuthContextValue = {
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    retryInitialization: vi.fn(),
    state: { status: 'authenticated', user },
  }

  render(
    <AuthContext.Provider value={context}>
      <AuthenticatedApiContext.Provider value={{ request: vi.fn().mockImplementation(() => failCount ? Promise.reject(new Error('count')) : Promise.resolve({ count })) }}>
      <MemoryRouter initialEntries={['/tickets']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route element={<h1>Contenido</h1>} path="/tickets" />
          </Route>
        </Routes>
      </MemoryRouter>
      </AuthenticatedApiContext.Provider>
    </AuthContext.Provider>,
  )

  return { context, user }
}

describe('AppLayout', () => {
  it.each(['ADMIN', 'TECHNICIAN', 'USER'] as const)('muestra Notificaciones con badge para %s', async (role) => {
    renderLayout(role, 4)
    expect(await screen.findByLabelText('4 notificaciones sin leer')).toBeVisible()
    expect(screen.getByRole('link', { name: /Notificaciones/ })).toBeVisible()
  })

  it('un fallo del count conserva navegación', async () => {
    renderLayout('USER', 0, true)
    expect(screen.getByRole('link', { name: 'Notificaciones' })).toBeVisible()
    expect(await screen.findByText('Contenido')).toBeVisible()
  })
  it.each(['ADMIN', 'TECHNICIAN'] as const)(
    'muestra usuario, logout y Dashboard para %s',
    (role) => {
      const { context, user } = renderLayout(role)

      expect(screen.getByText(user.fullName)).toBeVisible()
      expect(screen.getByText(user.email)).toBeVisible()
      expect(screen.getByRole('link', { name: 'Dashboard' })).toBeVisible()
      expect(screen.getByRole('link', { name: 'Tickets' })).toBeVisible()

      fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
      expect(context.logout).toHaveBeenCalledOnce()
    },
  )

  it('oculta Dashboard a USER y conserva navegación permitida', () => {
    renderLayout('USER')

    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tickets' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Notificaciones' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Configuración' })).toBeVisible()
  })
})
