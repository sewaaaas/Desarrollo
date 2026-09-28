import { useState } from 'react'
import type { FormEvent } from 'react'
import { TicketDialog } from '@/features/tickets/components/TicketDialog'
import {
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITIES,
  TICKET_STATUS_LABELS,
} from '@/features/tickets/model/ticket.constants'
import type {
  Ticket,
  TicketOptionCategory,
  TicketOptionUser,
  TicketPriority,
  TicketStatus,
  UpdateTicketInput,
} from '@/features/tickets/model/ticket.types'
import { Button } from '@/shared/components/Button'

interface TicketActionsProps {
  canAssign: boolean
  canEdit: boolean
  categories: TicketOptionCategory[]
  onAssign(assignedToId: string | null): Promise<void>
  onStatus(status: TicketStatus): Promise<void>
  onUpdate(input: Omit<UpdateTicketInput, 'version'>): Promise<void>
  ticket: Ticket
  technicians: TicketOptionUser[]
  transitions: TicketStatus[]
}

export function TicketActions({
  canAssign,
  canEdit,
  categories,
  onAssign,
  onStatus,
  onUpdate,
  ticket,
  technicians,
  transitions,
}: TicketActionsProps) {
  const [dialog, setDialog] = useState<'edit' | 'assign' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeStatus, setActiveStatus] = useState<TicketStatus | null>(null)

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const title = String(data.get('title') ?? '').trim()
    const description = String(data.get('description') ?? '').trim()
    const priority = String(data.get('priority')) as TicketPriority
    const categoryId = String(data.get('categoryId') ?? '') || null
    if (!title || title.length > 255) {
      setError('El título debe tener entre 1 y 255 caracteres.')
      return
    }
    if (description.length < 10) {
      setError('La descripción debe tener al menos 10 caracteres.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onUpdate({ categoryId, description, priority, title })
      setDialog(null)
    } catch (updateError: unknown) {
      if (updateError instanceof Error && updateError.message.includes('modificado por otra persona')) {
        setDialog(null)
        setError(null)
        return
      }
      setError(updateError instanceof Error ? updateError.message : 'No se pudo actualizar el ticket.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const value = String(data.get('assignedToId') ?? '')
    setSubmitting(true)
    setError(null)
    try {
      await onAssign(value || null)
      setDialog(null)
    } catch (assignError: unknown) {
      if (assignError instanceof Error && assignError.message.includes('modificado por otra persona')) {
        setDialog(null)
        setError(null)
        return
      }
      setError(assignError instanceof Error ? assignError.message : 'No se pudo cambiar la asignación.')
    } finally {
      setSubmitting(false)
    }
  }

  async function changeStatus(status: TicketStatus) {
    setError(null)
    setActiveStatus(status)
    try {
      await onStatus(status)
    } catch (statusError: unknown) {
      setError(statusError instanceof Error ? statusError.message : 'No se pudo cambiar el estado.')
    } finally {
      setActiveStatus(null)
    }
  }

  if (!canEdit && !canAssign && transitions.length === 0) return null

  return (
    <section aria-labelledby="ticket-actions-heading" className="border-t border-border pt-5">
      <h2 className="text-base font-bold text-foreground" id="ticket-actions-heading">Acciones</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {canEdit ? <Button onClick={() => { setError(null); setDialog('edit') }} size="sm" variant="secondary">Editar ticket</Button> : null}
        {canAssign ? <Button onClick={() => { setError(null); setDialog('assign') }} size="sm" variant="secondary">Cambiar asignación</Button> : null}
        {transitions.map((status) => (
          <Button
            isLoading={activeStatus === status}
            key={status}
            onClick={() => void changeStatus(status)}
            size="sm"
            variant={status === 'CANCELLED' ? 'danger' : 'primary'}
          >
            {TICKET_STATUS_LABELS[status]}
          </Button>
        ))}
      </div>
      {error && !dialog ? <p className="mt-3 text-sm text-danger" role="alert">{error}</p> : null}

      {dialog === 'edit' ? (
        <TicketDialog labelledBy="edit-ticket-title" onClose={() => setDialog(null)}>
          <h2 className="text-xl font-bold text-foreground" id="edit-ticket-title">Editar ticket</h2>
          <form className="mt-5 space-y-4" onSubmit={(event) => void handleEdit(event)}>
            <label className="block text-sm font-semibold text-foreground">
              Título
              <input className="mt-1 w-full rounded-control border border-border px-3 py-2" defaultValue={ticket.title} maxLength={255} name="title" required />
            </label>
            <label className="block text-sm font-semibold text-foreground">
              Descripción
              <textarea className="mt-1 min-h-32 w-full rounded-control border border-border px-3 py-2" defaultValue={ticket.description} minLength={10} name="description" required />
            </label>
            <label className="block text-sm font-semibold text-foreground">
              Prioridad
              <select className="mt-1 w-full rounded-control border border-border px-3 py-2" defaultValue={ticket.priority} name="priority">
                {TICKET_PRIORITIES.map((priority) => <option key={priority} value={priority}>{TICKET_PRIORITY_LABELS[priority]}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-foreground">
              Categoría
              <select className="mt-1 w-full rounded-control border border-border px-3 py-2" defaultValue={ticket.category?.id ?? ''} name="categoryId">
                <option value="">Sin categoría</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button onClick={() => setDialog(null)} variant="secondary">Cancelar</Button>
              <Button isLoading={submitting} type="submit">Guardar cambios</Button>
            </div>
          </form>
        </TicketDialog>
      ) : null}

      {dialog === 'assign' ? (
        <TicketDialog labelledBy="assign-ticket-title" onClose={() => setDialog(null)}>
          <h2 className="text-xl font-bold text-foreground" id="assign-ticket-title">Cambiar asignación</h2>
          <form className="mt-5" onSubmit={(event) => void handleAssign(event)}>
            <label className="block text-sm font-semibold text-foreground">
              Técnico
              <select className="mt-1 w-full rounded-control border border-border px-3 py-2" defaultValue={ticket.assignedTo?.id ?? ''} name="assignedToId">
                {ticket.status === 'OPEN' ? <option value="">Sin asignar</option> : null}
                {technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.fullName}</option>)}
              </select>
            </label>
            {ticket.status !== 'OPEN' ? <p className="mt-2 text-xs text-foreground-muted">Solo los tickets abiertos pueden quedar sin asignar.</p> : null}
            {error ? <p className="mt-3 text-sm text-danger" role="alert">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => setDialog(null)} variant="secondary">Cancelar</Button>
              <Button isLoading={submitting} type="submit">Guardar asignación</Button>
            </div>
          </form>
        </TicketDialog>
      ) : null}
    </section>
  )
}
