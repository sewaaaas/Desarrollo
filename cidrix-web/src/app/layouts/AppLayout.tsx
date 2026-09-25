import { NavLink, Outlet } from 'react-router'
import { useAuth } from '@/features/auth'
import { getNavigationItemsForRole } from '@/features/auth/routing/role-routes'
import { Button } from '@/shared/components/Button'

export function AppLayout() {
  const { logout, state } = useAuth()

  if (state.status !== 'authenticated') {
    return null
  }

  const navigationItems = getNavigationItemsForRole(state.user.role)
  const initials = state.user.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="border-b border-border bg-surface px-4 py-5 md:min-h-screen md:border-r md:border-b-0">
        <p className="px-3 text-lg font-bold tracking-tight text-foreground">
          CIDRIX
        </p>
        <nav aria-label="Navegación principal" className="mt-5">
          <ul className="flex gap-2 overflow-x-auto md:flex-col">
            {navigationItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  className={({ isActive }) =>
                    `block whitespace-nowrap rounded-control px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground'
                    }`
                  }
                  to={item.to}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-surface px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {state.user.avatarUrl ? (
              <img
                alt=""
                className="size-9 rounded-full object-cover"
                src={state.user.avatarUrl}
              />
            ) : (
              <span
                aria-hidden="true"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
              >
                {initials || 'CX'}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {state.user.fullName}
              </p>
              <p className="truncate text-xs text-foreground-muted">
                {state.user.email}
              </p>
            </div>
          </div>
          <Button
            onClick={() => void logout()}
            size="sm"
            variant="secondary"
          >
            Cerrar sesión
          </Button>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
