import { Card } from '@/shared/components/Card'
import { PageContainer } from '@/shared/components/PageContainer'

export function TicketsPlaceholderPage() {
  return (
    <PageContainer>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Tickets
      </h1>
      <Card className="mt-6">
        <p className="text-foreground-muted">
          El listado de tickets se implementará en una fase posterior.
        </p>
      </Card>
    </PageContainer>
  )
}
