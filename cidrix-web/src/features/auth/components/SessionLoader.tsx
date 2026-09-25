import { Spinner } from '@/shared/components/Spinner'

export function SessionLoader() {
  return (
    <main
      aria-busy="true"
      className="flex min-h-dvh items-center justify-center bg-background"
    >
      <div className="grid justify-items-center gap-3 text-foreground-muted">
        <Spinner label="Verificando sesión" size="lg" />
        <p className="text-sm">Verificando tu sesión…</p>
      </div>
    </main>
  )
}
