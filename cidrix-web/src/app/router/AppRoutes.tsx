import { Navigate, Route, Routes } from 'react-router'
import { AppLayout } from '@/app/layouts/AppLayout'
import { AuthLayout } from '@/app/layouts/AuthLayout'
import { GuestOnlyRoute } from '@/features/auth/routing/GuestOnlyRoute'
import { ProtectedRoute } from '@/features/auth/routing/ProtectedRoute'
import { RoleRoute } from '@/features/auth/routing/RoleRoute'
import { DashboardPlaceholderPage } from '@/features/dashboard/pages/DashboardPlaceholderPage'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { NotificationsPlaceholderPage } from '@/features/notifications/pages/NotificationsPlaceholderPage'
import { SettingsPlaceholderPage } from '@/features/settings/pages/SettingsPlaceholderPage'
import { TicketDetailPlaceholderPage } from '@/features/tickets/pages/TicketDetailPlaceholderPage'
import { TicketsPage } from '@/features/tickets/pages/TicketsPage'
import { Card } from '@/shared/components/Card'
import { PageContainer } from '@/shared/components/PageContainer'

function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center bg-background">
      <PageContainer>
        <Card className="mx-auto max-w-lg text-center">
          <p className="text-sm font-semibold text-primary">Error 404</p>
          <h1 className="mt-3 text-2xl font-bold text-foreground">
            Página no encontrada
          </h1>
          <p className="mt-3 text-foreground-muted">
            La ruta solicitada no existe.
          </p>
        </Card>
      </PageContainer>
    </main>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Navigate replace to="/login" />} path="/" />

      <Route element={<GuestOnlyRoute />}>
        <Route element={<AuthLayout />}>
          <Route element={<LoginPage />} path="/login" />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route element={<RoleRoute allowedRoles={['ADMIN', 'TECHNICIAN']} />}>
            <Route element={<DashboardPlaceholderPage />} path="/dashboard" />
          </Route>
          <Route element={<TicketsPage />} path="/tickets" />
          <Route
            element={<TicketDetailPlaceholderPage />}
            path="/tickets/:id"
          />
          <Route
            element={<NotificationsPlaceholderPage />}
            path="/notifications"
          />
          <Route element={<SettingsPlaceholderPage />} path="/settings" />
        </Route>
      </Route>

      <Route element={<NotFoundPage />} path="*" />
    </Routes>
  )
}
