import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { PageContainer } from '@/shared/components/PageContainer'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  hasError: boolean
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('Unexpected React error', error, info)
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <main className="flex min-h-screen items-center bg-background">
        <PageContainer>
          <Card className="mx-auto max-w-lg text-center">
            <h1 className="text-2xl font-bold text-foreground">
              Algo salió mal
            </h1>
            <p className="mt-3 text-foreground-muted">
              No pudimos mostrar esta pantalla. Intenta recargar la aplicación.
            </p>
            <Button className="mt-6" onClick={() => window.location.reload()}>
              Recargar
            </Button>
          </Card>
        </PageContainer>
      </main>
    )
  }
}
