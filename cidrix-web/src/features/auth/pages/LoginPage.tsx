import { AuthFormError } from '@/features/auth/components/AuthFormError'
import { CidrixBrand } from '@/features/auth/components/CidrixBrand'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Card } from '@/shared/components/Card'

export function LoginPage() {
  const { state } = useAuth()

  return (
    <Card className="mx-auto w-full max-w-[22.25rem] border-[#e4e7ec] px-7 py-7 shadow-overlay sm:px-8">
      <CidrixBrand />
      <h1 className="mt-4 text-center text-2xl font-bold tracking-tight text-[#111936]">
        Iniciar sesión
      </h1>
      {state.status === 'unauthenticated' && state.reason === 'expired' ? (
        <div className="mt-5">
          <AuthFormError
            error={{
              code: 'AUTH_SESSION_EXPIRED',
              kind: 'credentials',
              message: 'Tu sesión expiró. Inicia sesión nuevamente.',
            }}
          />
        </div>
      ) : null}
      <LoginForm />
      <p className="mt-5 text-center text-sm text-foreground-muted">
        ¿Olvidaste tu contraseña?
      </p>
    </Card>
  )
}
