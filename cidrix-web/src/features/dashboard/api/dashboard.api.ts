import type {
  DashboardOverview,
  DashboardPeriod,
  DashboardTrends,
} from '@/features/dashboard/model/dashboard.types'
import type { ApiClient } from '@/shared/services/api/api-client'

export function createDashboardApi(client: ApiClient) {
  return {
    getOverview(signal?: AbortSignal) {
      return client.request<DashboardOverview>('dashboard/overview', { signal })
    },
    getTrends(period: DashboardPeriod, signal?: AbortSignal) {
      return client.request<DashboardTrends>(
        `dashboard/trends?period=${encodeURIComponent(period)}`,
        { signal },
      )
    },
  }
}
