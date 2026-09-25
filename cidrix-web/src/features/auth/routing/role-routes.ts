import type { UserRole } from '@/features/auth/model/auth.types'

export interface NavigationItem {
  allowedRoles: readonly UserRole[]
  label: string
  to: string
}

const ALL_ROLES: readonly UserRole[] = ['ADMIN', 'TECHNICIAN', 'USER']

export const APP_NAVIGATION_ITEMS: readonly NavigationItem[] = [
  {
    allowedRoles: ['ADMIN', 'TECHNICIAN'],
    label: 'Dashboard',
    to: '/dashboard',
  },
  { allowedRoles: ALL_ROLES, label: 'Tickets', to: '/tickets' },
  {
    allowedRoles: ALL_ROLES,
    label: 'Notificaciones',
    to: '/notifications',
  },
  { allowedRoles: ALL_ROLES, label: 'Configuración', to: '/settings' },
]

export function getInitialRouteForRole(role: UserRole): string {
  return role === 'USER' ? '/tickets' : '/dashboard'
}

export function getNavigationItemsForRole(
  role: UserRole,
): readonly NavigationItem[] {
  return APP_NAVIGATION_ITEMS.filter((item) =>
    item.allowedRoles.includes(role),
  )
}

export function isRoleAllowedForPath(role: UserRole, pathname: string): boolean {
  if (pathname === '/dashboard') {
    return role === 'ADMIN' || role === 'TECHNICIAN'
  }

  return (
    pathname === '/tickets' ||
    /^\/tickets\/[^/]+$/.test(pathname) ||
    pathname === '/notifications' ||
    pathname === '/settings'
  )
}

export function resolvePostLoginDestination(
  role: UserRole,
  candidate: unknown,
): string {
  const fallback = getInitialRouteForRole(role)

  if (
    typeof candidate !== 'string' ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\')
  ) {
    return fallback
  }

  try {
    const baseUrl = 'https://cidrix.local'
    const parsedCandidate = new URL(candidate, baseUrl)

    if (
      parsedCandidate.origin !== baseUrl ||
      !isRoleAllowedForPath(role, parsedCandidate.pathname)
    ) {
      return fallback
    }

    return `${parsedCandidate.pathname}${parsedCandidate.search}${parsedCandidate.hash}`
  } catch {
    return fallback
  }
}
