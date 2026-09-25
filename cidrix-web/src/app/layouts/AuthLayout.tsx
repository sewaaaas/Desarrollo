import { Outlet } from 'react-router'

export function AuthLayout() {
  return (
    <div className="relative flex min-h-dvh flex-col bg-white sm:block">
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:min-h-dvh sm:px-6 sm:py-20">
        <div className="w-full">
          <Outlet />
        </div>
      </main>
      <footer className="px-4 pb-4 text-center text-xs leading-6 text-foreground-muted sm:absolute sm:inset-x-0 sm:bottom-0 sm:pb-6">
        <p>
          <span>Política de privacidad</span>
          <span aria-hidden="true" className="mx-2 text-border">
            |
          </span>
          <span>Términos de servicio</span>
        </p>
        <p>Copyright © CIDRIX 2023</p>
      </footer>
    </div>
  )
}
