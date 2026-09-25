import { Navigate, Outlet } from 'react-router'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { UserRole } from '@/features/auth/model/auth.types'
import { getInitialRouteForRole } from '@/features/auth/routing/role-routes'

interface RoleRouteProps {
  allowedRoles: readonly UserRole[]
}

export function RoleRoute({ allowedRoles }: RoleRouteProps) {
  const { state } = useAuth()

  if (state.status !== 'authenticated') {
    return null
  }

  if (!allowedRoles.includes(state.user.role)) {
    return <Navigate replace to={getInitialRouteForRole(state.user.role)} />
  }

  return <Outlet />
}
