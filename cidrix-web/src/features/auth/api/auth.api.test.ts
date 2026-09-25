import { describe, expect, it, vi } from 'vitest'
import { createAuthApi } from '@/features/auth/api/auth.api'
import type { AuthUser, LoginCredentials } from '@/features/auth/model/auth.types'
import type { ApiClient } from '@/shared/services/api/api-client'

const credentials: LoginCredentials = {
  email: 'admin@cidrix.test',
  password: 'secret-123',
}

const user: AuthUser = {
  avatarUrl: null,
  email: credentials.email,
  fullName: 'Admin CIDRIX',
  id: 'user-1',
  organizationId: 'org-1',
  role: 'ADMIN',
}

function createClient() {
  const client: ApiClient = { request: vi.fn() }
  return { client, request: vi.mocked(client.request) }
}

describe('authApi', () => {
  it('envía login con el body y método esperados', async () => {
    const { client, request } = createClient()
    request.mockResolvedValue({ accessToken: 'access-1' })

    await expect(createAuthApi(client).login(credentials)).resolves.toEqual({
      accessToken: 'access-1',
    })

    expect(request).toHaveBeenCalledWith('auth/login', {
      json: credentials,
      method: 'POST',
    })
  })

  it('refresca mediante el cliente base sin Bearer ni body', async () => {
    const { client, request } = createClient()
    request.mockResolvedValue({ accessToken: 'access-2' })

    await createAuthApi(client).refresh()

    expect(request).toHaveBeenCalledWith('auth/refresh', { method: 'POST' })
  })

  it('consulta /me con el Bearer recibido', async () => {
    const { client, request } = createClient()
    request.mockResolvedValue(user)

    await expect(createAuthApi(client).me('access-1')).resolves.toEqual(user)
    expect(request).toHaveBeenCalledWith('auth/me', {
      accessToken: 'access-1',
    })
  })

  it('cierra sesión con Bearer y descarta el mensaje del backend', async () => {
    const { client, request } = createClient()
    request.mockResolvedValue({ message: 'Sesión cerrada exitosamente' })

    await expect(createAuthApi(client).logout('access-1')).resolves.toBeUndefined()
    expect(request).toHaveBeenCalledWith('auth/logout', {
      accessToken: 'access-1',
      method: 'POST',
    })
  })

  it('propaga errores del cliente sin reinterpretar envelopes', async () => {
    const { client, request } = createClient()
    const error = new Error('backend error')
    request.mockRejectedValue(error)

    await expect(createAuthApi(client).login(credentials)).rejects.toBe(error)
  })
})
