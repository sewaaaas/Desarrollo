import { createContext } from 'react'
import type { AuthContextValue } from '@/features/auth/model/auth.types'
import type { ApiClient } from '@/shared/services/api/api-client'

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthenticatedApiContext = createContext<ApiClient | undefined>(
  undefined,
)
