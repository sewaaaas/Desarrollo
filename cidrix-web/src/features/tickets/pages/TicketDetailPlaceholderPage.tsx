import { useParams } from 'react-router'
import { Card } from '@/shared/components/Card'
import { PageContainer } from '@/shared/components/PageContainer'

export function TicketDetailPlaceholderPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <PageContainer>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Detalle del ticket
      </h1>
      <Card className="mt-6">
        <p className="text-foreground-muted">
          La vista de detalle se implementará en una fase posterior.
        </p>
        <p className="mt-3 text-sm text-foreground-muted">
          Identificador de ruta: <span className="font-mono">{id}</span>
        </p>
      </Card>
    </PageContainer>
  )
}
