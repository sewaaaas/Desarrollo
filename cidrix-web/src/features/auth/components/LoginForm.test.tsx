import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { AuthContext } from '@/features/auth/context/auth-context'
import type { AuthContextValue } from '@/features/auth/model/auth.types'
import { ApiError } from '@/shared/services/api/api-error'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

function createContextValue(
  login: AuthContextValue['login'] = vi.fn().mockResolvedValue(undefined),
): AuthContextValue {
  return {
    login,
    logout: vi.fn().mockResolvedValue(undefined),
    retryInitialization: vi.fn(),
    state: { reason: 'initial', status: 'unauthenticated', user: null },
  }
}

function renderLogin(login?: AuthContextValue['login']) {
  const contextValue = createContextValue(login)
  render(
    <AuthContext.Provider value={contextValue}>
      <LoginPage />
    </AuthContext.Provider>,
  )
  return contextValue
}

function fillValidForm(password = 'secret-123') {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), {
    target: { value: '  usuario@cidrix.test  ' },
  })
  fireEvent.change(screen.getByLabelText('Contraseña'), {
    target: { value: password },
  })
}

describe('Login', () => {
  it('renderiza la jerarquía y los atributos accesibles aprobados', () => {
    renderLogin()

    expect(screen.getByRole('img', { name: 'CIDRIX' })).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Iniciar sesión' }),
    ).toBeVisible()
    expect(screen.getByText('¿Olvidaste tu contraseña?')).toBeVisible()

    const email = screen.getByLabelText('Correo electrónico')
    const password = screen.getByLabelText('Contraseña')
    const submit = screen.getByRole('button', { name: 'Iniciar sesión' })

    expect(email).toHaveAttribute('type', 'email')
    expect(email).toHaveAttribute('autocomplete', 'username')
    expect(email).toBeRequired()
    expect(password).toHaveAttribute('type', 'password')
    expect(password).toHaveAttribute('autocomplete', 'current-password')
    expect(password).toHaveAttribute('minlength', '6')
    expect(submit).toHaveAttribute('type', 'submit')
  })

  it('valida campos localmente y enfoca el primer error', () => {
    const { login } = renderLogin()

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(screen.getByText('Ingresa tu correo electrónico.')).toBeVisible()
    expect(screen.getByText('Ingresa tu contraseña.')).toBeVisible()
    expect(screen.getByLabelText('Correo electrónico')).toHaveFocus()
    expect(login).not.toHaveBeenCalled()
  })

  it('rechaza email inválido y password demasiado corto', () => {
    const { login } = renderLogin()
    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'correo-invalido' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: '12345' },
    })

    fireEvent.submit(
      screen.getByRole('button', { name: 'Iniciar sesión' }).closest('form')!,
    )

    expect(
      screen.getByText('Ingresa un correo electrónico válido.'),
    ).toBeVisible()
    expect(
      screen.getByText('La contraseña debe tener al menos 6 caracteres.'),
    ).toBeVisible()
    expect(login).not.toHaveBeenCalled()
  })

  it('normaliza email, conserva password y permite submit nativo del formulario', async () => {
    const login = vi.fn().mockResolvedValue(undefined)
    renderLogin(login)
    fillValidForm(' secret ')

    fireEvent.submit(
      screen.getByRole('button', { name: 'Iniciar sesión' }).closest('form')!,
    )

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: 'usuario@cidrix.test',
        password: ' secret ',
      })
    })
  })

  it('muestra loading, deshabilita controles y evita doble submit', async () => {
    const pending = deferred()
    const login = vi.fn().mockReturnValue(pending.promise)
    renderLogin(login)
    fillValidForm()

    const submit = screen.getByRole('button', { name: 'Iniciar sesión' })
    fireEvent.click(submit)
    fireEvent.click(submit)

    expect(login).toHaveBeenCalledOnce()
    expect(submit).toBeDisabled()
    expect(submit).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByLabelText('Correo electrónico')).toBeDisabled()
    expect(screen.getByLabelText('Contraseña')).toBeDisabled()

    pending.resolve()
    await waitFor(() => expect(submit).not.toBeDisabled())
  })

  it('muestra un mensaje genérico ante login 401', async () => {
    const login = vi.fn().mockRejectedValue(
      new ApiError({
        code: 'UNAUTHORIZED',
        kind: 'http',
        message: 'La organización no está activa',
        status: 401,
      }),
    )
    renderLogin(login)
    fillValidForm()

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(
      await screen.findByText(
        'No pudimos iniciar sesión. Verifica tus credenciales o contacta al administrador.',
      ),
    ).toHaveAttribute('role', 'alert')
    expect(screen.queryByText('La organización no está activa')).not.toBeInTheDocument()
  })

  it('diferencia errores de red sin exponer detalles internos', async () => {
    const login = vi.fn().mockRejectedValue(
      new ApiError({
        code: 'API_NETWORK_ERROR',
        kind: 'network',
        message: 'Failed to fetch api.internal.local',
      }),
    )
    renderLogin(login)
    fillValidForm()

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(
      await screen.findByText(
        'El servicio no está disponible temporalmente. Inténtalo nuevamente.',
      ),
    ).toBeVisible()
    expect(screen.queryByText(/api\.internal\.local/)).not.toBeInTheDocument()
  })

  it('anuncia una sesión expirada sin reemplazar el formulario', () => {
    const contextValue = createContextValue()
    contextValue.state = {
      reason: 'expired',
      status: 'unauthenticated',
      user: null,
    }
    render(
      <AuthContext.Provider value={contextValue}>
        <LoginPage />
      </AuthContext.Provider>,
    )

    expect(
      screen.getByText('Tu sesión expiró. Inicia sesión nuevamente.'),
    ).toHaveAttribute('role', 'alert')
    expect(screen.getByLabelText('Correo electrónico')).toBeVisible()
  })
})
