import { Navigate, Outlet, useLocation } from 'react-router'
import { SessionLoader } from '@/features/auth/components/SessionLoader'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { SessionUnavailablePage } from '@/features/auth/pages/SessionUnavailablePage'
import { resolvePostLoginDestination } from '@/features/auth/routing/role-routes'

interface AuthLocationState {
  from?: unknown
}

export function GuestOnlyRoute() {
  const { state } = useAuth()
  const location = useLocation()

  if (state.status === 'initializing') {
    return <SessionLoader />
  }

  if (state.status === 'unavailable') {
    return <SessionUnavailablePage />
  }

  if (state.status === 'authenticated') {
    const locationState = location.state as AuthLocationState | null
    const destination = resolvePostLoginDestination(
      state.user.role,
      locationState?.from,
    )
    return <Navigate replace to={destination} />
  }

  return <Outlet />
}
