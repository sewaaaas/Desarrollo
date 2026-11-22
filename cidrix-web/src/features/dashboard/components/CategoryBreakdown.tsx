import type { DashboardCategoryMetric } from '@/features/dashboard/model/dashboard.types'
import { Card } from '@/shared/components/Card'

export function CategoryBreakdown({ categories }: { categories: DashboardCategoryMetric[] }) {
  return (
    <Card className="min-w-0">
      <h2 className="text-lg font-bold text-foreground">Por categoría</h2>
      {categories.length === 0 ? (
        <p className="mt-5 text-sm text-foreground-muted">
          Aún no hay tickets por categoría.
        </p>
      ) : (
        <ul className="mt-5 max-h-80 divide-y divide-border overflow-y-auto pr-1">
          {categories.map((category) => (
            <li
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              key={category.categoryId ?? 'uncategorized'}
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-medium text-foreground">
                  {category.categoryName}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {!category.isActive && category.categoryId !== null ? (
                    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-foreground-muted">
                      Inactiva
                    </span>
                  ) : null}
                  {category.isDeleted ? (
                    <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">
                      Eliminada
                    </span>
                  ) : null}
                </div>
              </div>
              <span className="shrink-0 text-lg font-bold tabular-nums text-foreground">
                {category.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
