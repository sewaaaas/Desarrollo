import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AuthContextValue, AuthState } from '@/features/auth/model/auth.types'
import { AuthContext, AuthenticatedApiContext } from '@/features/auth/context/auth-context'
import type { ApiClient } from '@/shared/services/api/api-client'
import { NotificationsUnreadProvider } from './NotificationsUnreadProvider'
import { useNotificationsUnread } from './notifications-unread-context'
import { UnreadBadge } from '../components/UnreadBadge'

function Consumer() {
  const { count, error, loading, refresh } = useNotificationsUnread()
  return <><output aria-label="Conteo">{count ?? 'desconocido'}</output><p>{loading ? 'cargando' : error ?? 'listo'}</p><UnreadBadge /><button onClick={refresh}>Refrescar conteo</button></>
}

const stateFor = (id: string): AuthState => ({ status: 'authenticated', user: { id, organizationId: 'org', avatarUrl: null, email: `${id}@test.dev`, fullName: id, role: 'USER' } })

function tree(state: AuthState, api: ApiClient) {
  const value: AuthContextValue = { state, login: vi.fn(), logout: vi.fn(), retryInitialization: vi.fn() }
  return <AuthContext.Provider value={value}><AuthenticatedApiContext.Provider value={api}><NotificationsUnreadProvider><Consumer /></NotificationsUnreadProvider></AuthenticatedApiContext.Provider></AuthContext.Provider>
}

describe('NotificationsUnreadProvider', () => {
  it.each([0, 8, 120])('comparte count %s y badge accesible', async (count) => {
    const request = vi.fn().mockResolvedValue({ count })
    render(tree(stateFor('a'), { request }))
    await waitFor(() => expect(screen.getByLabelText('Conteo')).toHaveTextContent(String(count)))
    expect(request).toHaveBeenCalledTimes(1)
    if (count === 0) expect(screen.queryByLabelText(/notificaciones sin leer/)).not.toBeInTheDocument()
    else expect(screen.getByLabelText(`${count} notificaciones sin leer`)).toHaveTextContent(count > 99 ? '99+' : String(count))
  })

  it('un error no confirma cero y permite reintentar', async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ count: 3 })
    render(tree(stateFor('a'), { request }))
    expect(await screen.findByText('No se pudo cargar el conteo de no leídas.')).toBeVisible()
    expect(screen.getByLabelText('Conteo')).toHaveTextContent('desconocido')
    fireEvent.click(screen.getByText('Refrescar conteo'))
    await waitFor(() => expect(screen.getByLabelText('Conteo')).toHaveTextContent('3'))
  })

  it('logout reinicia y no consulta sin sesión', async () => {
    const request = vi.fn().mockResolvedValue({ count: 8 })
    const view = render(tree(stateFor('a'), { request }))
    await waitFor(() => expect(screen.getByLabelText('Conteo')).toHaveTextContent('8'))
    view.rerender(tree({ status: 'unauthenticated', user: null }, { request }))
    expect(screen.getByLabelText('Conteo')).toHaveTextContent('desconocido')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('cambiar usuario borra count y aborta respuestas viejas', async () => {
    let resolveOld: (value: { count: number }) => void = () => undefined
    const pending = new Promise<{ count: number }>((resolve) => { resolveOld = resolve })
    const request = vi.fn().mockReturnValueOnce(pending).mockResolvedValueOnce({ count: 2 })
    const api: ApiClient = { request }
    const view = render(tree(stateFor('a'), api))
    const oldSignal = request.mock.calls[0]?.[1].signal as AbortSignal
    view.rerender(tree(stateFor('b'), api))
    expect(oldSignal.aborted).toBe(true)
    await waitFor(() => expect(screen.getByLabelText('Conteo')).toHaveTextContent('2'))
    resolveOld({ count: 99 })
    await Promise.resolve()
    expect(screen.getByLabelText('Conteo')).toHaveTextContent('2')
  })
})
