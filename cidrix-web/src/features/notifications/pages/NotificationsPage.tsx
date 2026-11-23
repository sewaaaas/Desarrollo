import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAuthenticatedApi } from '@/features/auth/hooks/useAuthenticatedApi'
import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { PageContainer } from '@/shared/components/PageContainer'
import { ApiError } from '@/shared/services/api/api-error'
import { createNotificationsApi } from '../api/notifications.api'
import { NotificationCard } from '../components/NotificationCard'
import { NotificationFilters } from '../components/NotificationFilters'
import { NotificationsPagination } from '../components/NotificationsPagination'
import { useNotificationsUnread } from '../context/notifications-unread-context'
import { NOTIFICATION_EMPTY_MESSAGES } from '../model/notification.constants'
import type { PaginatedNotifications } from '../model/notification.types'
import { notificationErrorMessage, notificationFiltersToSearchParams, readNotificationFilters } from '../model/notification.utils'

function NotificationsLoading() {
  return (
    <div aria-label="Cargando notificaciones" className="space-y-3 p-5" role="status">
      {[1, 2, 3].map((row) => <div className="h-40 animate-pulse rounded-control bg-surface-muted" key={row} />)}
    </div>
  )
}

export function NotificationsPage() {
  const client = useAuthenticatedApi()
  const api = useMemo(() => createNotificationsApi(client), [client])
  const unread = useNotificationsUnread()
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.toString()
  const filters = useMemo(() => readNotificationFilters(new URLSearchParams(search)), [search])
  const { filter, page } = filters
  const queryKey = notificationFiltersToSearchParams(filters).toString()
  const [version, setVersion] = useState(0)
  const requestKey = `${queryKey}|${version}`
  const [resource, setResource] = useState<{
    data: PaginatedNotifications | null
    error: string | null
    key: string
    query: string
  }>({ data: null, error: null, key: '', query: '' })
  const [mutation, setMutation] = useState<string | null>(null)
  const mutationController = useRef<AbortController | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const loading = resource.key !== requestKey
  const result = resource.query === queryKey ? resource.data : null
  const listError = loading ? null : resource.error
  const mutationBusy = mutation !== null
  const moveToValidPage = useEffectEvent((lastPage: number) => {
    setSearchParams(notificationFiltersToSearchParams({ filter, page: lastPage }), { replace: true })
  })

  useEffect(() => {
    if (search !== queryKey) setSearchParams(new URLSearchParams(queryKey), { replace: true })
  }, [queryKey, search, setSearchParams])

  useEffect(() => {
    const controller = new AbortController()
    void api.list({ filter, page }, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        const lastPage = Math.max(data.meta.totalPages, 1)
        if (page > lastPage) {
          moveToValidPage(lastPage)
          return
        }
        setResource({ data, error: null, key: requestKey, query: queryKey })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setResource((current) => ({
          data: current.query === queryKey ? current.data : null,
          error: notificationErrorMessage(error, 'No se pudieron cargar las notificaciones.'),
          key: requestKey,
          query: queryKey,
        }))
      })
    return () => controller.abort()
  }, [api, filter, page, queryKey, requestKey])

  useEffect(() => () => mutationController.current?.abort(), [])

  function refreshListAndCount() {
    setVersion((current) => current + 1)
    unread.refresh()
  }

  async function markRead(id: string) {
    if (mutationController.current || loading) return
    const controller = new AbortController()
    mutationController.current = controller
    setMutation(id)
    setMutationError(null)
    setAnnouncement('')
    try {
      await api.markRead(id, controller.signal)
      if (controller.signal.aborted) return
      setAnnouncement('Notificación marcada como leída.')
      refreshListAndCount()
    } catch (error: unknown) {
      if (controller.signal.aborted) return
      setMutationError(notificationErrorMessage(error, 'No se pudo marcar la notificación como leída.'))
      if (error instanceof ApiError && error.status === 404) refreshListAndCount()
    } finally {
      if (!controller.signal.aborted) {
        mutationController.current = null
        setMutation(null)
      }
    }
  }

  async function markAllRead() {
    if (mutationController.current || loading || unread.loading || unread.count === null || unread.count === 0) return
    const controller = new AbortController()
    mutationController.current = controller
    setMutation('all')
    setMutationError(null)
    setAnnouncement('')
    try {
      const { updatedCount } = await api.markAllRead(controller.signal)
      if (controller.signal.aborted) return
      setAnnouncement(`Se marcaron ${updatedCount} notificaciones como leídas.`)
      refreshListAndCount()
    } catch (error: unknown) {
      if (!controller.signal.aborted) setMutationError(notificationErrorMessage(error, 'No se pudieron marcar las notificaciones como leídas.'))
    } finally {
      if (!controller.signal.aborted) {
        mutationController.current = null
        setMutation(null)
      }
    }
  }

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Notificaciones</h1>
          <p className="mt-1 text-sm text-foreground-muted">Novedades de tus tickets y solicitudes de soporte.</p>
        </div>
        <Button disabled={loading || unread.loading || mutationBusy} onClick={refreshListAndCount} variant="secondary">Actualizar</Button>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className="text-sm text-foreground-muted">
          {unread.loading ? <p role="status">Actualizando conteo de no leídas…</p> : null}
          {!unread.loading && unread.count !== null ? <p><strong className="text-foreground">{unread.count}</strong> sin leer</p> : null}
          {!unread.loading && unread.error ? (
            <div className="flex flex-wrap items-center gap-2" role="alert">
              <p>No se pudo cargar el conteo de no leídas. {unread.error}</p>
              <Button onClick={unread.refresh} size="sm" variant="secondary">Reintentar conteo</Button>
            </div>
          ) : null}
        </div>
        <Button disabled={loading || unread.loading || unread.count === null || unread.count === 0 || mutationBusy} isLoading={mutation === 'all'} onClick={() => void markAllRead()} size="sm" variant="secondary">Marcar todas como leídas</Button>
      </div>

      <div className="mt-5">
        <NotificationFilters disabled={mutationBusy} onChange={(filter) => setSearchParams(notificationFiltersToSearchParams({ filter, page: 1 }))} value={filters.filter} />
      </div>
      <p aria-live="polite" className="mt-3 text-sm text-success">{announcement}</p>
      {mutationError ? <p className="mt-3 rounded-control border border-danger/30 bg-danger/5 p-3 text-sm text-danger" role="alert">{mutationError}</p> : null}

      <Card aria-busy={loading} className="mt-4 min-w-0 overflow-hidden p-0">
        {loading && !result ? <NotificationsLoading /> : null}
        {loading && result ? <p className="border-b border-border px-5 py-3 text-sm text-foreground-muted" role="status">Actualizando notificaciones…</p> : null}
        {listError ? (
          <div className="p-5" role="alert">
            <h2 className="font-semibold text-foreground">No se pudieron cargar las notificaciones</h2>
            <p className="mt-1 text-sm text-foreground-muted">{listError}{result ? ' Se muestran los últimos datos disponibles.' : ''}</p>
            <Button className="mt-3" onClick={() => setVersion((current) => current + 1)} size="sm" variant="secondary">Reintentar listado</Button>
          </div>
        ) : null}
        {result?.data.length === 0 ? <p className="p-8 text-center text-sm text-foreground-muted">{NOTIFICATION_EMPTY_MESSAGES[filters.filter]}</p> : null}
        {result && result.data.length > 0 ? (
          <ul className="divide-y divide-border">
            {result.data.map((item) => <NotificationCard busy={mutationBusy || loading} item={item} key={item.id} marking={mutation === item.id} onMarkRead={(id) => void markRead(id)} />)}
          </ul>
        ) : null}
        {result ? <NotificationsPagination busy={loading || mutationBusy} meta={result.meta} onPage={(page) => setSearchParams(notificationFiltersToSearchParams({ ...filters, page }))} /> : null}
      </Card>
    </PageContainer>
  )
}
