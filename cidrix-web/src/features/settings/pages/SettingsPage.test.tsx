import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, AuthenticatedApiContext } from '@/features/auth/context/auth-context'
import type { AuthContextValue, AuthState, UserRole } from '@/features/auth/model/auth.types'
import type { ApiClient, ApiRequestOptions } from '@/shared/services/api/api-client'
import { ApiError } from '@/shared/services/api/api-error'
import { SettingsPage } from './SettingsPage'

const saved = { timezone: 'America/Lima' }
type Handler = (path: string, options?: ApiRequestOptions) => Promise<unknown>
const defaultRequest: Handler = () => Promise.resolve(saved)
const stateFor = (role: UserRole = 'ADMIN', id = 'account-a', organizationId = 'org-a'): AuthState => ({
  status: 'authenticated', user: { id, organizationId, role, fullName: role, email: `${role}@test.dev`, avatarUrl: null },
})

function tree(state: AuthState, api: ApiClient) {
  const auth: AuthContextValue = { state, login: vi.fn(), logout: vi.fn(), retryInitialization: vi.fn() }
  return <AuthContext.Provider value={auth}><AuthenticatedApiContext.Provider value={api}><SettingsPage /></AuthenticatedApiContext.Provider></AuthContext.Provider>
}

function setup(handler: Handler = defaultRequest, role: UserRole = 'ADMIN') {
  const request = vi.fn().mockImplementation(handler)
  const api: ApiClient = { request }
  const view = render(tree(stateFor(role), api))
  return { request, ...view, changeSession: (state: AuthState) => view.rerender(tree(state, api)) }
}

const patches = (request: ReturnType<typeof vi.fn>) => request.mock.calls.filter(([, options]) => options?.method === 'PATCH')
const input = () => screen.getByRole('combobox', { name: 'Zona horaria' })
const change = (value: string) => fireEvent.change(input(), { target: { value } })
const submit = () => fireEvent.submit(screen.getByRole('form', { name: 'Editar configuración regional' }))
const httpError = (status: number) => new ApiError({ kind: 'http', status, code: 'INTERNAL', message: 'stack org-secret' })

describe('SettingsPage', () => {
  it('loading inicial no inventa UTC ni muestra editor antes del GET', () => {
    setup(() => new Promise(() => undefined))
    expect(screen.getByRole('status', { name: 'Cargando configuración' })).toBeVisible()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByText('UTC', { exact: true })).not.toBeInTheDocument()
  })

  it('ADMIN recibe valor real y controles de edición, sin campos futuros', async () => {
    const { request } = setup()
    expect(await screen.findByRole('combobox', { name: 'Zona horaria' })).toHaveValue('America/Lima')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Idioma|Logo|Perfil|Notificaciones/)).not.toBeInTheDocument()
    expect(request).toHaveBeenCalledExactlyOnceWith('settings', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it.each(['TECHNICIAN', 'USER'] as const)('%s solo lee y no envía PATCH', async (role) => {
    const { request } = setup(defaultRequest, role)
    expect(await screen.findByText('America/Lima', { exact: true })).toBeVisible()
    expect(screen.getByText('Solo un administrador puede cambiar esta configuración.')).toBeVisible()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
    expect(patches(request)).toHaveLength(0)
  })

  it.each([httpError(404), httpError(503), new ApiError({ kind: 'network', code: 'NET', message: 'internal' })])(
    'GET fallido no habilita editor y Reintentar recupera', async (error) => {
      let attempt = 0
      const { request } = setup(() => attempt++ === 0 ? Promise.reject(error) : defaultRequest('settings'))
      expect(await screen.findByRole('alert')).toBeVisible()
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
      expect(screen.queryByText(/stack org-secret/)).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
      await screen.findByRole('combobox', { name: 'Zona horaria' })
      expect(patches(request)).toHaveLength(0)
    },
  )

  it('sin cambios bloquea incluso submit programático', async () => {
    const { request } = setup()
    await screen.findByRole('combobox')
    submit()
    expect(patches(request)).toHaveLength(0)
  })

  it.each([['America/Lima', ' america/lima '], ['America/New_York', 'US/Eastern']])(
    'no envía PATCH por equivalencia canónica %s → %s', async (timezone, draft) => {
      const { request } = setup(() => Promise.resolve({ timezone }))
      await screen.findByRole('combobox')
      change(draft)
      expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
      submit()
      expect(patches(request)).toHaveLength(0)
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
      expect(input()).toHaveValue(timezone)
    },
  )

  it('guarda solo timezone con trim y adopta la respuesta canónica del servidor', async () => {
    const { request } = setup((_path, options) => Promise.resolve(options?.method === 'PATCH' ? { timezone: 'America/New_York' } : saved))
    await screen.findByRole('combobox')
    change('  america/new_york  ')
    expect(screen.getByText('Tienes cambios sin guardar.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Configuración guardada.')).toBeVisible()
    expect(input()).toHaveValue('America/New_York')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    expect(patches(request)).toHaveLength(1)
    expect(patches(request)[0]).toEqual(['settings', { method: 'PATCH', json: { timezone: 'america/new_york' }, signal: expect.any(AbortSignal) }])
  })

  it('acepta una zona IANA fuera de las sugerencias', async () => {
    const { request } = setup()
    await screen.findByRole('combobox')
    change('Pacific/Chatham')
    submit()
    await waitFor(() => expect(patches(request)).toHaveLength(1))
  })

  it('Cancelar revierte únicamente draft y no hace solicitudes', async () => {
    const { request } = setup()
    await screen.findByRole('combobox')
    change('Europe/Madrid')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(input()).toHaveValue('America/Lima')
    expect(request).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Cambios descartados.')).toBeVisible()
  })

  it.each(['', '   ', 'Invalid/Zone', 'GMT+5', '-05:00'])('valida draft inválido %j sin PATCH', async (value) => {
    const { request } = setup()
    await screen.findByRole('combobox')
    change(value)
    expect(input()).toHaveAttribute('aria-invalid', 'true')
    expect(input()).toHaveAccessibleDescription('Ingresa una zona horaria IANA válida, por ejemplo America/Lima.')
    expect(screen.getByRole('alert')).toHaveTextContent('Ingresa una zona horaria IANA válida')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    submit()
    expect(patches(request)).toHaveLength(0)
  })

  it.each([
    [httpError(400), 'La zona horaria no fue aceptada. Revisa el valor e inténtalo de nuevo.'],
    [httpError(403), 'No tienes permisos para modificar esta configuración.'],
    [httpError(404), 'La configuración de la organización no está disponible.'],
    [httpError(409), 'La configuración no se puede actualizar en este momento. Contacta al administrador.'],
    [httpError(500), 'El servicio no está disponible temporalmente. Inténtalo de nuevo.'],
    [new ApiError({ kind: 'network', code: 'NET', message: 'stack org-secret' }), 'No pudimos conectar con el servidor. Inténtalo de nuevo.'],
  ])('PATCH muestra error seguro y conserva draft', async (error, message) => {
    const { request } = setup((_path, options) => options?.method === 'PATCH' ? Promise.reject(error) : Promise.resolve(saved))
    await screen.findByRole('combobox')
    change('Europe/Madrid')
    submit()
    expect(await screen.findByRole('alert')).toHaveTextContent(message as string)
    expect(input()).toHaveValue('Europe/Madrid')
    expect(screen.queryByText('Configuración guardada.')).not.toBeInTheDocument()
    expect(screen.queryByText(/stack org-secret/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
    expect(patches(request)).toHaveLength(1)
    if (error instanceof ApiError && error.status === 400) {
      expect(input()).toHaveAttribute('aria-invalid', 'true')
      expect(input()).toHaveAccessibleDescription(expect.stringContaining(message as string))
    }
  })

  it('permite corregir/reintentar después de un PATCH fallido', async () => {
    let attempts = 0
    const { request } = setup((_path, options) => {
      if (options?.method !== 'PATCH') return Promise.resolve(saved)
      return attempts++ === 0 ? Promise.reject(httpError(400)) : Promise.resolve({ timezone: 'Europe/Madrid' })
    })
    await screen.findByRole('combobox')
    change('Pacific/Chatham')
    submit()
    await screen.findByRole('alert')
    change('Europe/Madrid')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    submit()
    await screen.findByText('Configuración guardada.')
    expect(patches(request)).toHaveLength(2)
    expect(input()).toHaveValue('Europe/Madrid')
  })

  it('bloquea doble submit, Cancelar y refresh durante PATCH', async () => {
    const { request, unmount } = setup((_path, options) => options?.method === 'PATCH' ? new Promise(() => undefined) : Promise.resolve(saved))
    await screen.findByRole('combobox')
    change('Europe/Madrid')
    const saveButton = screen.getByRole('button', { name: 'Guardar cambios' })
    submit()
    submit()
    expect(patches(request)).toHaveLength(1)
    expect(saveButton).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeDisabled()
    expect(input()).toBeDisabled()
    unmount()
    expect((patches(request)[0]?.[1].signal as AbortSignal).aborted).toBe(true)
  })

  it('refresh no descarta cambios y se habilita después de Cancelar', async () => {
    const { request } = setup()
    await screen.findByRole('combobox')
    change('Europe/Madrid')
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(input()).toHaveValue('Europe/Madrid')
    expect(request).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
  })

  it('refresh conserva base visible y adopta el nuevo GET', async () => {
    let resolveRefresh: (value: unknown) => void = () => undefined
    const pending = new Promise((resolve) => { resolveRefresh = resolve })
    let attempts = 0
    setup(() => attempts++ === 0 ? Promise.resolve(saved) : pending)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(input()).toHaveValue('America/Lima')
    expect(input()).toBeDisabled()
    await act(async () => resolveRefresh({ timezone: 'UTC' }))
    expect(input()).toHaveValue('UTC')
  })

  it('refresh fallido conserva último valor pero bloquea edición hasta retry', async () => {
    let attempts = 0
    setup(() => attempts++ === 1 ? Promise.reject(httpError(503)) : Promise.resolve(saved))
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    await screen.findByRole('alert')
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByText('America/Lima', { exact: true })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await screen.findByRole('combobox')
  })

  it.each([stateFor('ADMIN', 'account-b'), stateFor('ADMIN', 'account-a', 'org-b')])(
    'GET tardío no contamina una cuenta u organización nueva', async (nextState) => {
      let resolveOld: (value: unknown) => void = () => undefined
      const pending = new Promise((resolve) => { resolveOld = resolve })
      let attempts = 0
      const { request, changeSession } = setup(() => attempts++ === 0 ? pending : Promise.resolve({ timezone: 'Europe/Madrid' }))
      const signal = request.mock.calls[0]?.[1].signal as AbortSignal
      changeSession(nextState)
      expect(signal.aborted).toBe(true)
      expect(await screen.findByRole('combobox')).toHaveValue('Europe/Madrid')
      await act(async () => resolveOld(saved))
      expect(input()).toHaveValue('Europe/Madrid')
    },
  )

  it('cambio de rol/cuenta elimina draft y logout no hace GET', async () => {
    const { request, changeSession } = setup()
    await screen.findByRole('combobox')
    change('Europe/Madrid')
    changeSession(stateFor('USER', 'account-b'))
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    await screen.findByText('America/Lima', { exact: true })
    expect(screen.queryByText('Europe/Madrid', { exact: true })).not.toBeInTheDocument()
    changeSession({ status: 'unauthenticated', user: null })
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(request).toHaveBeenCalledTimes(2)
    expect(patches(request)).toHaveLength(0)
  })

  it('PATCH tardío de sesión anterior no modifica el valor actual', async () => {
    let resolvePatch: (value: unknown) => void = () => undefined
    const pending = new Promise((resolve) => { resolvePatch = resolve })
    const { request, changeSession } = setup((_path, options) => options?.method === 'PATCH' ? pending : Promise.resolve(saved))
    await screen.findByRole('combobox')
    change('Europe/Madrid')
    submit()
    changeSession(stateFor('ADMIN', 'account-b'))
    expect((patches(request)[0]?.[1].signal as AbortSignal).aborted).toBe(true)
    await screen.findByRole('combobox')
    await act(async () => resolvePatch({ timezone: 'Europe/Madrid' }))
    expect(input()).toHaveValue('America/Lima')
    expect(screen.queryByText('Configuración guardada.')).not.toBeInTheDocument()
  })

  it('desmontar con draft no guarda y aborta el GET', async () => {
    const { request, unmount } = setup()
    await screen.findByRole('combobox')
    change('Europe/Madrid')
    unmount()
    expect(patches(request)).toHaveLength(0)
    expect((request.mock.calls[0]?.[1].signal as AbortSignal).aborted).toBe(true)
  })

  it('StrictMode aborta el primer GET y descarta su respuesta tardía', async () => {
    let resolveOld: (value: unknown) => void = () => undefined
    const pending = new Promise((resolve) => { resolveOld = resolve })
    const request = vi.fn().mockReturnValueOnce(pending).mockResolvedValue(saved)
    render(<StrictMode>{tree(stateFor(), { request })}</StrictMode>)
    await screen.findByRole('combobox')
    expect((request.mock.calls[0]?.[1].signal as AbortSignal).aborted).toBe(true)
    await act(async () => resolveOld({ timezone: 'Europe/Madrid' }))
    expect(input()).toHaveValue('America/Lima')
  })

  it('cancelación de GET no se presenta como error', async () => {
    setup(() => Promise.reject(new ApiError({ kind: 'aborted', code: 'ABORT', message: 'aborted' })))
    await act(async () => undefined)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
