import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { createAttachmentsApi } from '@/features/tickets/api/attachments.api'
import { createCommentsApi } from '@/features/tickets/api/comments.api'
import { createTicketsApi } from '@/features/tickets/api/tickets.api'
import { AttachmentsPanel } from '@/features/tickets/components/AttachmentsPanel'
import { CommentComposer } from '@/features/tickets/components/CommentComposer'
import { TicketActions } from '@/features/tickets/components/TicketActions'
import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from '@/features/tickets/components/TicketBadge'
import { TicketTimeline } from '@/features/tickets/components/TicketTimeline'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useAuthenticatedApi } from '@/features/auth/hooks/useAuthenticatedApi'
import {
  availableStatusTransitions,
  canEditTicket,
  canUseInternalVisibility,
  canWriteActivity,
  isAssignedTechnician,
  isTerminalTicket,
  safeTicketsReturnTarget,
} from '@/features/tickets/model/ticket-detail'
import type {
  Attachment,
  CommentVisibility,
  CreateCommentInput,
  PaginatedTimeline,
  Ticket,
  TicketOptionCategory,
  TicketOptionUser,
  TicketStatus,
  TimelineItem,
  UpdateTicketInput,
} from '@/features/tickets/model/ticket.types'
import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { PageContainer } from '@/shared/components/PageContainer'
import { ApiError } from '@/shared/services/api/api-error'

const dateFormatter = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatDate(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : dateFormatter.format(date)
}

function resourceError(error: unknown, resource: string): string {
  if (error instanceof ApiError) {
    if (error.kind === 'network') return `No pudimos conectar para cargar ${resource}.`
    if (error.status === 403) return `No tienes permiso para consultar ${resource}.`
    if (error.status && error.status >= 500) return `El servidor no pudo cargar ${resource}.`
  }
  return `No se pudo cargar ${resource}.`
}

function mutationError(error: unknown, fallback: string): Error {
  if (error instanceof ApiError) {
    if (error.status === 400) return new Error(error.message || 'Los datos enviados no son válidos.')
    if (error.status === 403) return new Error('No tienes permiso para realizar esta acción.')
    if (error.status === 404) return new Error('El recurso ya no está disponible.')
    if (error.status === 413) return new Error('El archivo supera el límite permitido por el servidor.')
    if (error.status === 409) return new Error('Este ticket fue modificado por otra persona.')
    if (error.kind === 'network') return new Error('No pudimos conectar con el servidor.')
  }
  return new Error(fallback)
}

function MainTicketError({
  returnTo,
  status,
}: {
  returnTo: string
  status?: number
}) {
  const forbidden = status === 403
  return (
    <PageContainer>
      <Card className="mx-auto max-w-xl text-center">
        <p className="text-sm font-semibold text-primary">{forbidden ? 'Acceso restringido' : 'Error 404'}</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">
          {forbidden ? 'No tienes acceso a este ticket' : 'Ticket no encontrado'}
        </h1>
        <Link className="mt-5 inline-flex min-h-10 items-center rounded-control bg-primary px-4 text-sm font-semibold text-white" to={returnTo}>Volver a Tickets</Link>
      </Card>
    </PageContainer>
  )
}

function TicketMetadata({ ticket }: { ticket: Ticket }) {
  const rows = [
    ['Categoría', ticket.category?.name ?? 'Sin categoría'],
    ['Solicitante', ticket.createdBy.fullName],
    ['Técnico', ticket.assignedTo?.fullName ?? 'Sin asignar'],
    ['Creado', formatDate(ticket.createdAt)],
    ['Actualizado', formatDate(ticket.updatedAt)],
    ['Primera respuesta', formatDate(ticket.firstResponseAt)],
    ['Resuelto', formatDate(ticket.resolvedAt)],
    ['Cerrado', formatDate(ticket.closedAt)],
  ].filter(([, value]) => value !== null)

  return (
    <dl className="space-y-4">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{label}</dt>
          <dd className="mt-1 break-words text-sm text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function TicketDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const location = useLocation()
  const returnTo = safeTicketsReturnTarget((location.state as { from?: unknown } | null)?.from)
  const authenticatedClient = useAuthenticatedApi()
  const ticketsApi = useMemo(() => createTicketsApi(authenticatedClient), [authenticatedClient])
  const commentsApi = useMemo(() => createCommentsApi(authenticatedClient), [authenticatedClient])
  const attachmentsApi = useMemo(() => createAttachmentsApi(authenticatedClient), [authenticatedClient])
  const { state: authState } = useAuth()
  const user = authState.status === 'authenticated' ? authState.user : null
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [mainError, setMainError] = useState<{ message: string; status?: number } | null>(null)
  const [mainLoading, setMainLoading] = useState(true)
  const [ticketRequestVersion, setTicketRequestVersion] = useState(0)
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [timelineMeta, setTimelineMeta] = useState<PaginatedTimeline['meta']>({ limit: 20, page: 1, total: 0, totalPages: 0 })
  const [timelinePage, setTimelinePage] = useState(1)
  const [timelineVersion, setTimelineVersion] = useState(0)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null)
  const [attachmentsVersion, setAttachmentsVersion] = useState(0)
  const [categories, setCategories] = useState<TicketOptionCategory[]>([])
  const [technicians, setTechnicians] = useState<TicketOptionUser[]>([])
  const [activeTab, setActiveTab] = useState<'activity' | 'files'>('activity')
  const [announcement, setAnnouncement] = useState('')
  const [conflict, setConflict] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    // Reinicia el recurso visible al cambiar de ticket para no mostrar datos obsoletos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMainLoading(true)
    setMainError(null)
    setTicket(null)
    setConflict(false)
    void ticketsApi
      .get(id, controller.signal)
      .then((response) => setTicket(response))
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.kind === 'aborted') return
        setMainError({
          message: resourceError(error, 'el ticket'),
          status: error instanceof ApiError ? error.status : undefined,
        })
      })
      .finally(() => {
        if (!controller.signal.aborted) setMainLoading(false)
      })
    return () => controller.abort()
  }, [id, ticketRequestVersion, ticketsApi])

  useEffect(() => {
    if (!ticket) return
    const controller = new AbortController()
    // Expone el loading local incluso cuando conservamos páginas ya cargadas.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimelineLoading(true)
    setTimelineError(null)
    void ticketsApi
      .getTimeline(ticket.id, timelinePage, controller.signal)
      .then((response) => {
        setTimeline((current) => timelinePage === 1 ? response.data : [...current, ...response.data])
        setTimelineMeta(response.meta)
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.kind === 'aborted') return
        setTimelineError(resourceError(error, 'la actividad'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setTimelineLoading(false)
      })
    return () => controller.abort()
  }, [ticket, timelinePage, timelineVersion, ticketsApi])

  useEffect(() => {
    if (!ticket) return
    const controller = new AbortController()
    // Conserva el detalle mientras esta sección secundaria se actualiza.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAttachmentsLoading(true)
    setAttachmentsError(null)
    void attachmentsApi
      .list(ticket.id, 1, controller.signal)
      .then((response) => setAttachments(response.data))
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.kind === 'aborted') return
        setAttachmentsError(resourceError(error, 'los archivos'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setAttachmentsLoading(false)
      })
    return () => controller.abort()
  }, [attachmentsApi, attachmentsVersion, ticket])

  useEffect(() => {
    if (!ticket || !user) return
    const controller = new AbortController()
    const mayEdit = canEditTicket(ticket, user)
    if (mayEdit) {
      void ticketsApi.listCategories(controller.signal)
        .then((response) => setCategories(response.data))
        .catch(() => setCategories([]))
    }
    if (user.role === 'ADMIN' && !isTerminalTicket(ticket)) {
      void ticketsApi.listActiveUsers(controller.signal)
        .then((response) => setTechnicians(response.data.filter((option) => option.role === 'TECHNICIAN')))
        .catch(() => setTechnicians([]))
    }
    return () => controller.abort()
  }, [ticket, ticketsApi, user])

  const refreshTimeline = useCallback(() => {
    setTimeline([])
    setTimelinePage(1)
    setTimelineVersion((current) => current + 1)
  }, [])

  function handleMutationFailure(error: unknown, fallback: string): never {
    if (error instanceof ApiError && error.status === 409) setConflict(true)
    throw mutationError(error, fallback)
  }

  async function updateTicket(input: Omit<UpdateTicketInput, 'version'>) {
    if (!ticket) return
    try {
      const response = await ticketsApi.update(ticket.id, { ...input, version: ticket.version })
      setTicket(response)
      setAnnouncement('Ticket actualizado correctamente.')
      refreshTimeline()
    } catch (error: unknown) {
      handleMutationFailure(error, 'No se pudo actualizar el ticket.')
    }
  }

  async function assignTicket(assignedToId: string | null) {
    if (!ticket) return
    try {
      const response = await ticketsApi.assign(ticket.id, { assignedToId, version: ticket.version })
      setTicket(response)
      setAnnouncement(assignedToId ? 'Técnico asignado correctamente.' : 'Ticket desasignado correctamente.')
      refreshTimeline()
    } catch (error: unknown) {
      handleMutationFailure(error, 'No se pudo cambiar la asignación.')
    }
  }

  async function updateStatus(status: TicketStatus) {
    if (!ticket) return
    try {
      const response = await ticketsApi.updateStatus(ticket.id, { status, version: ticket.version })
      setTicket(response)
      setAnnouncement('Estado actualizado correctamente.')
      refreshTimeline()
    } catch (error: unknown) {
      handleMutationFailure(error, 'No se pudo cambiar el estado.')
    }
  }

  async function createComment(input: CreateCommentInput) {
    if (!ticket) return
    try {
      await commentsApi.create(ticket.id, input)
      setAnnouncement('Comentario publicado correctamente.')
      refreshTimeline()
      try {
        const refreshedTicket = await ticketsApi.get(ticket.id)
        setTicket(refreshedTicket)
      } catch {
        // El comentario ya fue creado. El detalle podrá recargarse sin duplicar el POST.
      }
    } catch (error: unknown) {
      throw mutationError(error, 'No se pudo publicar el comentario.')
    }
  }

  async function uploadAttachment(file: File, visibility: CommentVisibility) {
    if (!ticket) return
    try {
      await attachmentsApi.upload(ticket.id, file, visibility)
      setAnnouncement('Archivo subido correctamente.')
      setAttachmentsVersion((current) => current + 1)
    } catch (error: unknown) {
      throw mutationError(error, 'No se pudo subir el archivo.')
    }
  }

  async function downloadAttachment(attachment: Attachment) {
    if (!ticket) return
    try {
      const blob = await attachmentsApi.download(ticket.id, attachment.id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = attachment.originalName
      anchor.style.display = 'none'
      document.body.append(anchor)
      try {
        anchor.click()
      } finally {
        anchor.remove()
        URL.revokeObjectURL(url)
      }
    } catch (error: unknown) {
      throw mutationError(error, 'No se pudo descargar el archivo.')
    }
  }

  async function deleteAttachment(attachment: Attachment) {
    if (!ticket) return
    try {
      await attachmentsApi.remove(ticket.id, attachment.id)
      setAnnouncement('Archivo eliminado correctamente.')
      setAttachmentsVersion((current) => current + 1)
    } catch (error: unknown) {
      throw mutationError(error, 'No se pudo eliminar el archivo.')
    }
  }

  if (mainLoading) {
    return (
      <PageContainer>
        <div aria-label="Cargando ticket" className="space-y-4" role="status">
          <div className="h-10 w-2/3 animate-pulse rounded-control bg-surface-muted" />
          <div className="h-72 animate-pulse rounded-card bg-surface-muted" />
        </div>
      </PageContainer>
    )
  }

  if (mainError?.status === 403 || mainError?.status === 404) {
    return <MainTicketError returnTo={returnTo} status={mainError.status} />
  }

  if (mainError || !ticket || !user) {
    return (
      <PageContainer>
        <Card className="mx-auto max-w-xl text-center" role="alert">
          <h1 className="text-xl font-bold text-foreground">No se pudo cargar el ticket</h1>
          <p className="mt-2 text-sm text-foreground-muted">{mainError?.message ?? 'El ticket no está disponible.'}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Link className="inline-flex min-h-10 items-center rounded-control border border-border px-4 text-sm font-semibold" to={returnTo}>Volver a Tickets</Link>
            <Button onClick={() => setTicketRequestVersion((current) => current + 1)}>Reintentar</Button>
          </div>
        </Card>
      </PageContainer>
    )
  }

  const writable = canWriteActivity(ticket, user)
  const allowInternal = canUseInternalVisibility(user.role)
  const assignedTech = isAssignedTechnician(ticket, user)
  const disabledReason = isTerminalTicket(ticket)
    ? 'Este ticket está cerrado para nueva actividad.'
    : user.role === 'TECHNICIAN' && !assignedTech
      ? 'Solo el técnico asignado puede añadir actividad.'
      : undefined
  const transitions = availableStatusTransitions(ticket, user)

  return (
    <PageContainer>
      <Link className="inline-flex items-center text-sm font-semibold text-primary hover:underline" to={returnTo}>← Volver a Tickets</Link>
      <header className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">{ticket.ticketNumber}</p>
          <h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-foreground">{ticket.title}</h1>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-foreground-muted">{ticket.description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <TicketPriorityBadge priority={ticket.priority} />
          <TicketStatusBadge status={ticket.status} />
        </div>
      </header>

      <p aria-live="polite" className="sr-only">{announcement}</p>
      {conflict ? (
        <div className="mt-5 flex flex-col gap-3 rounded-control border border-danger/30 bg-danger/5 p-4 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <p className="text-sm font-semibold text-danger">Este ticket fue modificado por otra persona.</p>
          <Button onClick={() => setTicketRequestVersion((current) => current + 1)} size="sm" variant="secondary">Recargar ticket</Button>
        </div>
      ) : null}

      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="min-w-0 p-4 sm:p-6">
          <div className="flex border-b border-border" role="tablist" aria-label="Contenido del ticket">
            <button
              aria-selected={activeTab === 'activity'}
              className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === 'activity' ? 'border-primary text-primary' : 'border-transparent text-foreground-muted'}`}
              onClick={() => setActiveTab('activity')}
              role="tab"
              type="button"
            >Actividad</button>
            <button
              aria-selected={activeTab === 'files'}
              className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === 'files' ? 'border-primary text-primary' : 'border-transparent text-foreground-muted'}`}
              onClick={() => setActiveTab('files')}
              role="tab"
              type="button"
            >Archivos ({attachments.length})</button>
          </div>

          {activeTab === 'activity' ? (
            <div className="mt-5" role="tabpanel">
              <CommentComposer allowInternal={allowInternal} disabledReason={writable ? undefined : disabledReason} onSubmit={createComment} />
              <div className="mt-6">
                <TicketTimeline
                  error={timelineError}
                  items={timeline}
                  loading={timelineLoading}
                  onLoadMore={() => setTimelinePage((current) => current + 1)}
                  onRetry={refreshTimeline}
                  page={timelineMeta.page}
                  totalPages={timelineMeta.totalPages}
                />
              </div>
            </div>
          ) : (
            <div className="mt-5" role="tabpanel">
              <AttachmentsPanel
                allowDelete={user.role === 'ADMIN'}
                allowInternal={allowInternal}
                attachments={attachments}
                canUpload={writable}
                error={attachmentsError}
                loading={attachmentsLoading}
                onDelete={deleteAttachment}
                onDownload={downloadAttachment}
                onRetry={() => setAttachmentsVersion((current) => current + 1)}
                onUpload={uploadAttachment}
              />
            </div>
          )}
        </Card>

        <Card className="h-fit min-w-0">
          <h2 className="text-lg font-bold text-foreground">Información</h2>
          <div className="mt-5"><TicketMetadata ticket={ticket} /></div>
          <div className="mt-5">
            <TicketActions
              canAssign={user.role === 'ADMIN' && !isTerminalTicket(ticket)}
              canEdit={canEditTicket(ticket, user)}
              categories={categories}
              onAssign={assignTicket}
              onStatus={updateStatus}
              onUpdate={updateTicket}
              technicians={technicians}
              ticket={ticket}
              transitions={transitions}
            />
          </div>
        </Card>
      </div>
    </PageContainer>
  )
}
