import { describe, expect, it, vi } from 'vitest'
import { createDashboardApi } from '@/features/dashboard/api/dashboard.api'
import type { ApiClient } from '@/shared/services/api/api-client'

function setup() {
  const client: ApiClient = { request: vi.fn() }
  return { api: createDashboardApi(client), request: vi.mocked(client.request) }
}

describe('dashboardApi', () => {
  it('consulta Overview usando la fachada autenticada y AbortSignal', async () => {
    const { api, request } = setup()
    const controller = new AbortController()
    request.mockResolvedValue({ summary: { total: 0 } })

    await api.getOverview(controller.signal)

    expect(request).toHaveBeenCalledWith('dashboard/overview', {
      signal: controller.signal,
    })
  })

  it.each(['7d', '30d', '90d'] as const)(
    'serializa correctamente el período %s',
    async (period) => {
      const { api, request } = setup()
      const controller = new AbortController()
      request.mockResolvedValue({ period })

      await api.getTrends(period, controller.signal)

      expect(request).toHaveBeenCalledWith(
        `dashboard/trends?period=${period}`,
        { signal: controller.signal },
      )
    },
  )

  it('propaga los errores sin reinterpretarlos', async () => {
    const { api, request } = setup()
    const error = new Error('fallo de API')
    request.mockRejectedValue(error)

    await expect(api.getOverview()).rejects.toBe(error)
    await expect(api.getTrends('30d')).rejects.toBe(error)
  })
})
