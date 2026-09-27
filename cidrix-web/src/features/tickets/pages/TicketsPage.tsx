import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { createTicketsApi } from '@/features/tickets/api/tickets.api'
import { CreateTicketDialog } from '@/features/tickets/components/CreateTicketDialog'
import { TicketFiltersPanel } from '@/features/tickets/components/TicketFiltersPanel'
import { TicketsList } from '@/features/tickets/components/TicketsList'
import {
  readTicketFilters,
  ticketFiltersToSearchParams,
} from '@/features/tickets/model/ticket-query'
import type {
  CreateTicketInput,
  PaginatedTickets,
  Ticket,
  TicketFilters,
  TicketOptionCategory,
  TicketOptionUser,
} from '@/features/tickets/model/ticket.types'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useAuthenticatedApi } from '@/features/auth/hooks/useAuthenticatedApi'
import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { PageContainer } from '@/shared/components/PageContainer'
import { ApiError } from '@/shared/services/api/api-error'

function ticketErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'network') return 'No pudimos conectar con el servidor.'
    if (error.status === 403) return 'No tienes permiso para consultar estos tickets.'
    if (error.status === 400) return 'Los filtros enviados no son válidos.'
  }
  return 'No pudimos cargar los tickets.'
}

function LoadingTickets() {
  return (
    <div aria-label="Cargando tickets" className="space-y-3 p-4" role="status">
      {[1, 2, 3, 4, 5].map((row) => (
        <div className="h-12 animate-pulse rounded-control bg-surface-muted" key={row} />
      ))}
    </div>
  )
}

function hasActiveFilters(filters: TicketFilters): boolean {
  return Boolean(
    filters.search ||
      filters.status ||
      filters.priority ||
      filters.categoryId ||
      filters.assignedToId ||
      filters.createdById ||
      filters.dateFrom ||
      filters.dateTo,
  )
}

export function TicketsPage() {
  const authenticatedApi = useAuthenticatedApi()
  const ticketsApi = useMemo(() => createTicketsApi(authenticatedApi), [authenticatedApi])
  const { state } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => readTicketFilters(searchParams), [searchParams])
  const role = state.status === 'authenticated' ? state.user.role : 'USER'
  const effectiveFilters = useMemo(
    () =>
      role === 'ADMIN'
        ? filters
        : { ...filters, assignedToId: undefined, createdById: undefined },
    [filters, role],
  )
  const [refreshVersion, setRefreshVersion] = useState(0)
  const requestKey = `${ticketFiltersToSearchParams(effectiveFilters).toString()}|${refreshVersion}`
  const [requestState, setRequestState] = useState<{
    error: string | null
    key: string
    result: PaginatedTickets | null
  }>({ error: null, key: '', result: null })
  const [categories, setCategories] = useState<TicketOptionCategory[]>([])
  const [users, setUsers] = useState<TicketOptionUser[]>([])
  const [announcement, setAnnouncement] = useState('')
  const loading = requestState.key !== requestKey
  const result = loading ? null : requestState.result
  const error = loading ? null : requestState.error

  useEffect(() => {
    if (role === 'ADMIN' || (!filters.assignedToId && !filters.createdById)) return
    setSearchParams(ticketFiltersToSearchParams(effectiveFilters), { replace: true })
  }, [effectiveFilters, filters.assignedToId, filters.createdById, role, setSearchParams])

  useEffect(() => {
    const controller = new AbortController()

    void ticketsApi
      .list(effectiveFilters, controller.signal)
      .then((response) =>
        setRequestState({ error: null, key: requestKey, result: response }),
      )
      .catch((requestError: unknown) => {
        if (requestError instanceof ApiError && requestError.kind === 'aborted') return
        setRequestState({
          error: ticketErrorMessage(requestError),
          key: requestKey,
          result: null,
        })
      })

    return () => controller.abort()
  }, [effectiveFilters, requestKey, ticketsApi])

  useEffect(() => {
    if (role === 'USER') {
      return
    }

    const controller = new AbortController()
    void ticketsApi
      .listCategories(controller.signal)
      .then((response) => setCategories(response.data))
      .catch(() => setCategories([]))

    if (role === 'ADMIN') {
      void ticketsApi
        .listActiveUsers(controller.signal)
        .then((response) => setUsers(response.data))
        .catch(() => setUsers([]))
    }

    return () => controller.abort()
  }, [role, ticketsApi])

  const updateFilters = useCallback(
    (patch: Partial<TicketFilters>) => {
      const next = { ...effectiveFilters, ...patch }
      if (!Object.hasOwn(patch, 'page')) next.page = 1
      setSearchParams(ticketFiltersToSearchParams(next))
    },
    [effectiveFilters, setSearchParams],
  )

  const createTicket = useCallback(
    (input: CreateTicketInput) => ticketsApi.create(input),
    [ticketsApi],
  )

  function handleCreated(ticket: Ticket) {
    setAnnouncement(`${ticket.ticketNumber} se creó correctamente.`)
    setRefreshVersion((current) => current + 1)
  }

  const totalPages = Math.max(result?.meta.totalPages ?? 1, 1)
  const showFilteredEmpty = hasActiveFilters(effectiveFilters)

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tickets</h1>
          <p className="mt-1 text-sm text-foreground-muted">Consulta, filtra y registra solicitudes de soporte.</p>
        </div>
        <CreateTicketDialog
          categories={categories}
          onCreate={createTicket}
          onCreated={handleCreated}
          role={role}
          users={users}
        />
      </div>

      <p aria-live="polite" className="sr-only">{announcement}</p>

      <Card className="mt-6 overflow-hidden p-0">
        <TicketFiltersPanel
          categories={role === 'USER' ? [] : categories}
          filters={effectiveFilters}
          hasActiveFilters={hasActiveFilters(effectiveFilters)}
          key={effectiveFilters.search ?? ''}
          onChange={updateFilters}
          onClear={() => setSearchParams(new URLSearchParams())}
          role={role}
          users={role === 'ADMIN' ? users : []}
        />

        {loading ? <LoadingTickets /> : null}
        {!loading && error ? (
          <div className="p-8 text-center" role="alert">
            <h2 className="text-lg font-bold text-foreground">No se pudo cargar el listado</h2>
            <p className="mt-2 text-sm text-foreground-muted">{error}</p>
            <Button className="mt-4" onClick={() => setRefreshVersion((current) => current + 1)}>Reintentar</Button>
          </div>
        ) : null}
        {!loading && !error && result?.data.length === 0 ? (
          <div className="p-8 text-center">
            <h2 className="text-lg font-bold text-foreground">
              {showFilteredEmpty ? 'No encontramos resultados' : 'Aún no hay tickets'}
            </h2>
            <p className="mt-2 text-sm text-foreground-muted">
              {showFilteredEmpty
                ? 'Prueba con otros filtros o limpia la búsqueda.'
                : 'Crea el primer ticket para empezar a gestionar solicitudes.'}
            </p>
            {showFilteredEmpty ? (
              <Button
                className="mt-4"
                onClick={() => setSearchParams(new URLSearchParams())}
                variant="secondary"
              >
                Limpiar filtros
              </Button>
            ) : null}
          </div>
        ) : null}
        {!loading && !error && result && result.data.length > 0 ? <TicketsList tickets={result.data} /> : null}

        {!loading && !error && result && result.data.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-foreground-muted">
              Página {result.meta.page} de {totalPages} · {result.meta.total} tickets
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm text-foreground-muted">
                Por página{' '}
                <select
                  className="ml-1 min-h-9 rounded-control border border-border bg-surface px-2"
                  onChange={(event) => updateFilters({ limit: Number(event.target.value) })}
                  value={effectiveFilters.limit}
                >
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </label>
              <Button
                disabled={effectiveFilters.page <= 1}
                onClick={() => updateFilters({ page: effectiveFilters.page - 1 })}
                size="sm"
                variant="secondary"
              >
                Anterior
              </Button>
              <Button
                disabled={effectiveFilters.page >= totalPages}
                onClick={() => updateFilters({ page: effectiveFilters.page + 1 })}
                size="sm"
                variant="secondary"
              >
                Siguiente
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </PageContainer>
  )
}
