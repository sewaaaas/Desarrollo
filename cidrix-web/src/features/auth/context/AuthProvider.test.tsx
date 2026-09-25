import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthApi } from '@/features/auth/api/auth.api'
import { AuthProvider } from '@/features/auth/context/AuthProvider'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useAuthenticatedApi } from '@/features/auth/hooks/useAuthenticatedApi'
import type { AuthUser } from '@/features/auth/model/auth.types'
import { AuthSessionManager } from '@/features/auth/session/auth-session-manager'
import type { ApiClient } from '@/shared/services/api/api-client'
import { ApiError } from '@/shared/services/api/api-error'

const user: AuthUser = {
  avatarUrl: null,
  email: 'tech@cidrix.test',
  fullName: 'Técnico CIDRIX',
  id: 'user-2',
  organizationId: 'org-1',
  role: 'TECHNICIAN',
}

function unauthorizedError() {
  return new ApiError({
    code: 'UNAUTHORIZED',
    kind: 'http',
    message: 'No autorizado',
    status: 401,
  })
}

function networkError() {
  return new ApiError({
    code: 'API_NETWORK_ERROR',
    kind: 'network',
    message: 'Sin conexión',
  })
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

function Probe() {
  const { login, logout, retryInitialization, state } = useAuth()
  const authenticatedApi = useAuthenticatedApi()
  const reason = state.status === 'unauthenticated' ? state.reason : undefined

  return (
    <div>
      <output aria-label="status">{`${state.status}${reason ? `:${reason}` : ''}`}</output>
      {state.status === 'authenticated' ? <p>{state.user.fullName}</p> : null}
      <button
        onClick={() =>
          void login({ email: user.email, password: 'secret-123' })
        }
        type="button"
      >
        login
      </button>
      <button onClick={() => void logout()} type="button">
        logout
      </button>
      <button onClick={retryInitialization} type="button">
        retry
      </button>
      <button
        onClick={() => void authenticatedApi.request('tickets')}
        type="button"
      >
        request
      </button>
    </div>
  )
}

describe('AuthProvider', () => {
  let apiClient: ApiClient
  let authApi: AuthApi
  let manager: AuthSessionManager

  beforeEach(() => {
    apiClient = { request: vi.fn() }
    authApi = {
      login: vi.fn(),
      logout: vi.fn(),
      me: vi.fn(),
      refresh: vi.fn(),
    }
    manager = new AuthSessionManager({ apiClient, authApi })
  })

  function renderProvider(children = <Probe />) {
    return render(
      <AuthProvider sessionManager={manager}>{children}</AuthProvider>,
    )
  }

  it('inicia en initializing y restaura refresh + /me', async () => {
    const refresh = deferred<{ accessToken: string }>()
    vi.mocked(authApi.refresh).mockReturnValue(refresh.promise)
    vi.mocked(authApi.me).mockResolvedValue(user)

    renderProvider()

    expect(screen.getByLabelText('status')).toHaveTextContent('initializing')
    refresh.resolve({ accessToken: 'restored-token' })

    await waitFor(() => {
      expect(screen.getByLabelText('status')).toHaveTextContent('authenticated')
    })
    expect(screen.getByText(user.fullName)).toBeVisible()
    expect(authApi.me).toHaveBeenCalledWith('restored-token')
  })

  it('convierte refresh 401 en sesión anónima', async () => {
    vi.mocked(authApi.refresh).mockRejectedValue(unauthorizedError())

    renderProvider()

    await waitFor(() => {
      expect(screen.getByLabelText('status')).toHaveTextContent(
        'unauthenticated:initial',
      )
    })
  })

  it('invalida si /me responde 401 después del refresh', async () => {
    vi.mocked(authApi.refresh).mockResolvedValue({ accessToken: 'restored' })
    vi.mocked(authApi.me).mockRejectedValue(unauthorizedError())

    renderProvider()

    await waitFor(() => {
      expect(screen.getByLabelText('status')).toHaveTextContent(
        'unauthenticated:initial',
      )
    })
    expect(authApi.refresh).toHaveBeenCalledOnce()
    expect(authApi.me).toHaveBeenCalledOnce()
  })

  it('diferencia indisponibilidad y permite reintentar', async () => {
    vi.mocked(authApi.refresh)
      .mockRejectedValueOnce(networkError())
      .mockResolvedValueOnce({ accessToken: 'restored' })
    vi.mocked(authApi.me).mockResolvedValue(user)

    renderProvider()

    await waitFor(() => {
      expect(screen.getByLabelText('status')).toHaveTextContent('unavailable')
    })

    fireEvent.click(screen.getByRole('button', { name: 'retry' }))

    expect(screen.getByLabelText('status')).toHaveTextContent('initializing')
    await waitFor(() => {
      expect(screen.getByLabelText('status')).toHaveTextContent('authenticated')
    })
    expect(authApi.refresh).toHaveBeenCalledTimes(2)
  })

  it('publica el usuario solo después de login y /me', async () => {
    vi.mocked(authApi.refresh).mockRejectedValueOnce(unauthorizedError())
    vi.mocked(authApi.login).mockResolvedValue({ accessToken: 'login-token' })
    vi.mocked(authApi.me).mockResolvedValue(user)

    renderProvider()
    await waitFor(() =>
      expect(screen.getByLabelText('status')).toHaveTextContent('unauthenticated'),
    )

    fireEvent.click(screen.getByRole('button', { name: 'login' }))

    await waitFor(() => {
      expect(screen.getByLabelText('status')).toHaveTextContent('authenticated')
    })
    expect(authApi.login).toHaveBeenCalledWith({
      email: user.email,
      password: 'secret-123',
    })
    expect(authApi.me).toHaveBeenCalledWith('login-token')
  })

  it('limpia estado local durante logout y mantiene la fachada sin token', async () => {
    vi.mocked(authApi.refresh).mockResolvedValue({ accessToken: 'restored' })
    vi.mocked(authApi.me).mockResolvedValue(user)
    vi.mocked(authApi.logout).mockResolvedValue()

    renderProvider()
    await screen.findByText(user.fullName)

    fireEvent.click(screen.getByRole('button', { name: 'logout' }))

    await waitFor(() => {
      expect(screen.getByLabelText('status')).toHaveTextContent(
        'unauthenticated:logout',
      )
    })
    expect(authApi.logout).toHaveBeenCalledWith('restored')
  })

  it('la fachada autenticada añade Bearer sin exponerlo en el contexto', async () => {
    vi.mocked(authApi.refresh).mockResolvedValue({ accessToken: 'restored' })
    vi.mocked(authApi.me).mockResolvedValue(user)
    vi.mocked(apiClient.request).mockResolvedValue({ data: [] })

    function ContextInspector() {
      const auth = useAuth()
      return (
        <div data-context-keys={Object.keys(auth).join(',')} data-testid="context">
          <Probe />
        </div>
      )
    }

    renderProvider(<ContextInspector />)
    await screen.findByText(user.fullName)
    fireEvent.click(screen.getByRole('button', { name: 'request' }))

    await waitFor(() => expect(apiClient.request).toHaveBeenCalledOnce())
    expect(apiClient.request).toHaveBeenCalledWith('tickets', {
      accessToken: 'restored',
    })
    expect(screen.getByTestId('context')).not.toHaveAttribute(
      'data-context-keys',
      expect.stringContaining('accessToken'),
    )
  })

  it('Strict Mode comparte una sola inicialización efectiva', async () => {
    vi.mocked(authApi.refresh).mockResolvedValue({ accessToken: 'restored' })
    vi.mocked(authApi.me).mockResolvedValue(user)

    render(
      <StrictMode>
        <AuthProvider sessionManager={manager}>
          <Probe />
        </AuthProvider>
      </StrictMode>,
    )

    await screen.findByText(user.fullName)
    expect(authApi.refresh).toHaveBeenCalledOnce()
    expect(authApi.me).toHaveBeenCalledOnce()
  })
})
