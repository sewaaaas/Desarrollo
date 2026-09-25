import { Navigate, Outlet, useLocation } from 'react-router'
import { SessionLoader } from '@/features/auth/components/SessionLoader'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { SessionUnavailablePage } from '@/features/auth/pages/SessionUnavailablePage'

export function ProtectedRoute() {
  const { state } = useAuth()
  const location = useLocation()

  if (state.status === 'initializing') {
    return <SessionLoader />
  }

  if (state.status === 'unavailable') {
    return <SessionUnavailablePage />
  }

  if (state.status === 'unauthenticated') {
    const from = `${location.pathname}${location.search}${location.hash}`
    return <Navigate replace state={{ from }} to="/login" />
  }

  return <Outlet />
}
