import { Button } from '@/shared/components/Button'
import type { PaginationMeta } from '@/shared/services/api/api.types'

export function NotificationsPagination({ meta, busy, onPage }: { meta: PaginationMeta; busy: boolean; onPage: (page: number) => void }) {
  const totalPages = Math.max(meta.totalPages, 1)
  return (
    <nav aria-label="Paginación de notificaciones" className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-foreground-muted">Página {meta.page} de {totalPages} · {meta.total} notificaciones</p>
      <div className="flex gap-2">
        <Button disabled={busy || meta.page <= 1} onClick={() => onPage(meta.page - 1)} size="sm" variant="secondary">Anterior</Button>
        <Button disabled={busy || meta.page >= totalPages} onClick={() => onPage(meta.page + 1)} size="sm" variant="secondary">Siguiente</Button>
      </div>
    </nav>
  )
}
