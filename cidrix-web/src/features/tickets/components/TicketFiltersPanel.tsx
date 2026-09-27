import { useState } from 'react'
import {
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_SORT_OPTIONS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
} from '@/features/tickets/model/ticket.constants'
import type {
  TicketFilters,
  TicketOptionCategory,
  TicketOptionUser,
} from '@/features/tickets/model/ticket.types'
import type { UserRole } from '@/features/auth/model/auth.types'
import { Button } from '@/shared/components/Button'

const selectClasses =
  'min-h-10 rounded-control border border-border bg-surface px-3 py-2 text-sm text-foreground hover:border-foreground-muted'

interface TicketFiltersPanelProps {
  categories: TicketOptionCategory[]
  filters: TicketFilters
  hasActiveFilters: boolean
  onChange(patch: Partial<TicketFilters>): void
  onClear(): void
  role: UserRole
  users: TicketOptionUser[]
}

export function TicketFiltersPanel({
  categories,
  filters,
  hasActiveFilters,
  onChange,
  onClear,
  role,
  users,
}: TicketFiltersPanelProps) {
  const [search, setSearch] = useState(filters.search ?? '')

  return (
    <section aria-label="Filtros de tickets" className="border-b border-border p-4">
      <form
        className="flex flex-col gap-3 lg:flex-row lg:items-end"
        onSubmit={(event) => {
          event.preventDefault()
          onChange({ search: search.trim() || undefined })
        }}
      >
        <label className="grid min-w-0 flex-1 gap-1.5 text-sm font-medium text-foreground">
          Buscar
          <input
            className={selectClasses}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Título del ticket"
            type="search"
            value={search}
          />
        </label>
        <Button type="submit">Buscar</Button>
        {filters.search ? (
          <Button
            onClick={() => {
              setSearch('')
              onChange({ search: undefined })
            }}
            variant="secondary"
          >
            Limpiar búsqueda
          </Button>
        ) : null}
      </form>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          Estado
          <select
            className={selectClasses}
            onChange={(event) => onChange({ status: event.target.value as TicketFilters['status'] || undefined })}
            value={filters.status ?? ''}
          >
            <option value="">Todos</option>
            {TICKET_STATUSES.map((status) => <option key={status} value={status}>{TICKET_STATUS_LABELS[status]}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          Prioridad
          <select
            className={selectClasses}
            onChange={(event) => onChange({ priority: event.target.value as TicketFilters['priority'] || undefined })}
            value={filters.priority ?? ''}
          >
            <option value="">Todas</option>
            {TICKET_PRIORITIES.map((priority) => <option key={priority} value={priority}>{TICKET_PRIORITY_LABELS[priority]}</option>)}
          </select>
        </label>
        {role !== 'USER' ? (
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Categoría
            <select
              className={selectClasses}
              onChange={(event) => onChange({ categoryId: event.target.value || undefined })}
              value={filters.categoryId ?? ''}
            >
              <option value="">Todas</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
        ) : null}
        {role === 'ADMIN' ? (
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Asignado a
            <select
              className={selectClasses}
              onChange={(event) => onChange({ assignedToId: event.target.value || undefined })}
              value={filters.assignedToId ?? ''}
            >
              <option value="">Todos</option>
              {users.filter((user) => user.role === 'TECHNICIAN').map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
            </select>
          </label>
        ) : null}
        {role === 'ADMIN' ? (
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Creado por
            <select
              className={selectClasses}
              onChange={(event) => onChange({ createdById: event.target.value || undefined })}
              value={filters.createdById ?? ''}
            >
              <option value="">Todos</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
            </select>
          </label>
        ) : null}
        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          Ordenar por
          <select
            className={selectClasses}
            onChange={(event) => onChange({ sortBy: event.target.value as TicketFilters['sortBy'] })}
            value={filters.sortBy}
          >
            {TICKET_SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          Dirección
          <select
            className={selectClasses}
            onChange={(event) => onChange({ sortOrder: event.target.value as TicketFilters['sortOrder'] })}
            value={filters.sortOrder}
          >
            <option value="desc">Descendente</option>
            <option value="asc">Ascendente</option>
          </select>
        </label>
      </div>
      {hasActiveFilters ? (
        <Button className="mt-3" onClick={onClear} size="sm" variant="secondary">
          Limpiar filtros
        </Button>
      ) : null}
    </section>
  )
}
