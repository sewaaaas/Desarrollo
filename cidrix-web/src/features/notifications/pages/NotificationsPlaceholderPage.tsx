import { Card } from '@/shared/components/Card'
import { PageContainer } from '@/shared/components/PageContainer'

export function NotificationsPlaceholderPage() {
  return (
    <PageContainer>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Notificaciones
      </h1>
      <Card className="mt-6">
        <p className="text-foreground-muted">
          Las notificaciones se implementarán en una fase posterior.
        </p>
      </Card>
    </PageContainer>
  )
}
