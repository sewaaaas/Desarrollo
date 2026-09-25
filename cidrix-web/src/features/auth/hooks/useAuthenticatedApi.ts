import { useContext } from 'react'
import { AuthenticatedApiContext } from '@/features/auth/context/auth-context'

export function useAuthenticatedApi() {
  const context = useContext(AuthenticatedApiContext)

  if (!context) {
    throw new Error('useAuthenticatedApi debe utilizarse dentro de AuthProvider')
  }

  return context
}
