import { describe, expect, it, vi } from 'vitest'
import { createApiClient } from '@/shared/services/api/api-client'
import type { ApiClient } from '@/shared/services/api/api-client'
import { createSettingsApi } from './settings.api'

describe('settingsApi', () => {
  it('GET usa ruta relativa y señal, y devuelve el payload del cliente', async () => {
    const request = vi.fn().mockResolvedValue({ timezone: 'UTC' })
    const api = createSettingsApi({ request })
    const signal = new AbortController().signal
    await expect(api.getSettings(signal)).resolves.toEqual({ timezone: 'UTC' })
    expect(request).toHaveBeenCalledExactlyOnceWith('settings', { signal })
  })

  it('PATCH serializa solo timezone con trim, sin propiedades extra', async () => {
    const request = vi.fn().mockResolvedValue({ timezone: 'America/Lima' })
    const api = createSettingsApi({ request })
    const signal = new AbortController().signal
    const input = { timezone: '  America/Lima  ', organizationId: 'ignored', language: 'ignored' }
    await expect(api.updateSettings(input, signal)).resolves.toEqual({ timezone: 'America/Lima' })
    expect(request).toHaveBeenCalledExactlyOnceWith('settings', {
      method: 'PATCH', json: { timezone: 'America/Lima' }, signal,
    })
  })

  it('GET y PATCH propagan errores sin duplicar solicitudes', async () => {
    const error = new Error('request failed')
    const request = vi.fn().mockRejectedValue(error)
    const client: ApiClient = { request }
    const api = createSettingsApi(client)
    await expect(api.getSettings()).rejects.toBe(error)
    await expect(api.updateSettings({ timezone: 'UTC' })).rejects.toBe(error)
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('reutiliza el envelope existente sin duplicar api/v1', async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { timezone: 'UTC' } })))
    const client = createApiClient({ baseUrl: 'https://api.test/api/v1', fetchImplementation })
    await expect(createSettingsApi(client).getSettings()).resolves.toEqual({ timezone: 'UTC' })
    expect(fetchImplementation).toHaveBeenCalledWith('https://api.test/api/v1/settings', expect.objectContaining({ method: 'GET', credentials: 'include' }))
  })
})
