import type { ApiClient } from '@/shared/services/api/api-client'
import type { OrganizationSettings, UpdateSettings } from '../model/settings.types'

export function createSettingsApi(client: ApiClient) {
  return {
    getSettings(signal?: AbortSignal) {
      return client.request<OrganizationSettings>('settings', { signal })
    },
    updateSettings({ timezone }: UpdateSettings, signal?: AbortSignal) {
      return client.request<OrganizationSettings>('settings', {
        method: 'PATCH',
        json: { timezone: timezone.trim() },
        signal,
      })
    },
  }
}
