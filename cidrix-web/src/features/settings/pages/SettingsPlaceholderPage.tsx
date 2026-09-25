import { Card } from '@/shared/components/Card'
import { PageContainer } from '@/shared/components/PageContainer'

export function SettingsPlaceholderPage() {
  return (
    <PageContainer>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Configuración
      </h1>
      <Card className="mt-6">
        <p className="text-foreground-muted">
          La configuración de la organización se implementará en una fase
          posterior.
        </p>
      </Card>
    </PageContainer>
  )
}
