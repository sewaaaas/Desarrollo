import { apiClient } from '@/shared/services/api/api-client'
import type { ApiClient } from '@/shared/services/api/api-client'
import type {
  AuthUser,
  LoginCredentials,
  LoginResponse,
  RefreshResponse,
} from '@/features/auth/model/auth.types'

export interface AuthApi {
  login(credentials: LoginCredentials): Promise<LoginResponse>
  logout(accessToken: string): Promise<void>
  me(accessToken: string): Promise<AuthUser>
  refresh(): Promise<RefreshResponse>
}

export function createAuthApi(client: ApiClient = apiClient): AuthApi {
  return {
    login(credentials) {
      return client.request<LoginResponse>('auth/login', {
        json: credentials,
        method: 'POST',
      })
    },
    async logout(accessToken) {
      await client.request<{ message: string }>('auth/logout', {
        accessToken,
        method: 'POST',
      })
    },
    me(accessToken) {
      return client.request<AuthUser>('auth/me', { accessToken })
    },
    refresh() {
      return client.request<RefreshResponse>('auth/refresh', {
        method: 'POST',
      })
    },
  }
}

export const authApi = createAuthApi()
