import { useAuth } from '@/features/auth/hooks/useAuth'
import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { PageContainer } from '@/shared/components/PageContainer'

export function SessionUnavailablePage() {
  const { retryInitialization, state } = useAuth()
  const message =
    state.status === 'unavailable'
      ? state.error.message
      : 'No fue posible verificar tu sesión.'

  return (
    <main className="flex min-h-dvh items-center bg-background">
      <PageContainer>
        <Card className="mx-auto max-w-md text-center">
          <p className="text-sm font-semibold text-primary">CIDRIX</p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            No pudimos conectar
          </h1>
          <p className="mt-3 leading-7 text-foreground-muted" role="alert">
            {message}
          </p>
          <Button className="mt-6" onClick={retryInitialization}>
            Reintentar
          </Button>
        </Card>
      </PageContainer>
    </main>
  )
}
