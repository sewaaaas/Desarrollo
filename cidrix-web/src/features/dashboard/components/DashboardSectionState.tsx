import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'

export function DashboardSectionLoading({ label }: { label: string }) {
  return (
    <Card aria-label={label} className="min-h-48 space-y-4" role="status">
      <div className="h-5 w-40 animate-pulse rounded bg-surface-muted" />
      <div className="h-20 animate-pulse rounded-control bg-surface-muted" />
      <div className="h-10 animate-pulse rounded-control bg-surface-muted" />
    </Card>
  )
}

interface DashboardSectionErrorProps {
  description: string
  onRetry: () => void
  title: string
}

export function DashboardSectionError({
  description,
  onRetry,
  title,
}: DashboardSectionErrorProps) {
  return (
    <Card className="min-h-48 text-center" role="alert">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-foreground-muted">{description}</p>
      <Button className="mt-4" onClick={onRetry} size="sm" variant="secondary">
        Reintentar
      </Button>
    </Card>
  )
}
