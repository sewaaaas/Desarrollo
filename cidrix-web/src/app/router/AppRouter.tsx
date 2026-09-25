import { BrowserRouter } from 'react-router'
import { AppRoutes } from '@/app/router/AppRoutes'

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
