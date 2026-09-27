import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import type { UserRole } from '@/features/auth/model/auth.types'
import {
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
} from '@/features/tickets/model/ticket.constants'
import type {
  CreateTicketInput,
  Ticket,
  TicketOptionCategory,
  TicketOptionUser,
  TicketPriority,
} from '@/features/tickets/model/ticket.types'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'
import { ApiError } from '@/shared/services/api/api-error'

const fieldClasses =
  'min-h-10 w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-card hover:border-foreground-muted'

interface CreateTicketDialogProps {
  categories: TicketOptionCategory[]
  onCreate(input: CreateTicketInput): Promise<Ticket>
  onCreated(ticket: Ticket): void
  role: UserRole
  users: TicketOptionUser[]
}

interface FormErrors {
  description?: string
  form?: string
  title?: string
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'network') return 'No pudimos conectar con el servidor. Inténtalo nuevamente.'
    if (error.status === 403) return 'No tienes permiso para crear el ticket con esos datos.'
    if (error.status === 400) return 'Revisa los datos ingresados e inténtalo nuevamente.'
  }
  return 'No pudimos crear el ticket. Inténtalo nuevamente.'
}

export function CreateTicketDialog({
  categories,
  onCreate,
  onCreated,
  role,
  users,
}: CreateTicketDialogProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM')
  const [categoryId, setCategoryId] = useState('')
  const [assignedToId, setAssignedToId] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const submittingRef = useRef(false)
  const headingId = useId()
  const descriptionId = useId()
  const descriptionFieldId = useId()

  useEffect(() => {
    if (!open) return
    titleRef.current?.focus()
  }, [open])

  function reset() {
    setTitle('')
    setDescription('')
    setPriority('MEDIUM')
    setCategoryId('')
    setAssignedToId('')
    setErrors({})
  }

  function close() {
    if (submitting) return
    setOpen(false)
    reset()
    queueMicrotask(() => triggerRef.current?.focus())
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }

    if (event.key !== 'Tab') return
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])',
      ) ?? [],
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submittingRef.current) return
    const nextErrors: FormErrors = {}
    const normalizedTitle = title.trim()
    const normalizedDescription = description.trim()

    if (!normalizedTitle) nextErrors.title = 'El título es obligatorio.'
    else if (normalizedTitle.length > 255) nextErrors.title = 'El título no puede superar 255 caracteres.'
    if (normalizedDescription.length < 10) nextErrors.description = 'La descripción debe tener al menos 10 caracteres.'

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    setErrors({})
    try {
      const ticket = await onCreate({
        title: normalizedTitle,
        description: normalizedDescription,
        priority,
        ...(role !== 'USER' && categoryId ? { categoryId } : {}),
        ...(role === 'ADMIN' && assignedToId ? { assignedToId } : {}),
      })
      setOpen(false)
      reset()
      onCreated(ticket)
      queueMicrotask(() => triggerRef.current?.focus())
    } catch (error: unknown) {
      setErrors({ form: errorMessage(error) })
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button ref={triggerRef} onClick={() => setOpen(true)}>Nuevo ticket</Button>
      {open ? (
        <div
          aria-describedby={descriptionId}
          aria-labelledby={headingId}
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-foreground/45 p-4"
          onKeyDown={handleDialogKeyDown}
          ref={dialogRef}
          role="dialog"
        >
          <div className="my-auto w-full max-w-xl rounded-card border border-border bg-surface p-5 shadow-overlay sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-foreground" id={headingId}>Crear ticket</h2>
                <p className="mt-1 text-sm text-foreground-muted" id={descriptionId}>Describe el problema para que el equipo pueda atenderlo.</p>
              </div>
              <Button aria-label="Cerrar" onClick={close} size="sm" variant="secondary">×</Button>
            </div>

            <form className="mt-5 grid gap-4" onSubmit={(event) => void submit(event)}>
              {errors.form ? <p aria-live="polite" className="rounded-control bg-danger/10 p-3 text-sm text-danger" role="alert">{errors.form}</p> : null}
              <Input
                autoComplete="off"
                error={errors.title}
                label="Título"
                maxLength={255}
                onChange={(event) => setTitle(event.target.value)}
                ref={titleRef}
                required
                value={title}
              />
              <label className="grid gap-1.5 text-sm font-medium text-foreground" htmlFor={descriptionFieldId}>
                Descripción
                <textarea
                  aria-invalid={errors.description ? true : undefined}
                  className={`${fieldClasses} min-h-28 resize-y ${errors.description ? 'border-danger' : ''}`}
                  id={descriptionFieldId}
                  onChange={(event) => setDescription(event.target.value)}
                  required
                  value={description}
                />
                {errors.description ? <span className="text-sm text-danger">{errors.description}</span> : <span className="text-sm font-normal text-foreground-muted">Mínimo 10 caracteres.</span>}
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                Prioridad
                <select className={fieldClasses} onChange={(event) => setPriority(event.target.value as TicketPriority)} value={priority}>
                  {TICKET_PRIORITIES.map((value) => <option key={value} value={value}>{TICKET_PRIORITY_LABELS[value]}</option>)}
                </select>
              </label>
              {role !== 'USER' ? (
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  Categoría <span className="font-normal text-foreground-muted">(opcional)</span>
                  <select className={fieldClasses} onChange={(event) => setCategoryId(event.target.value)} value={categoryId}>
                    <option value="">Sin categoría</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
              ) : null}
              {role === 'ADMIN' ? (
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  Asignar a <span className="font-normal text-foreground-muted">(opcional)</span>
                  <select className={fieldClasses} onChange={(event) => setAssignedToId(event.target.value)} value={assignedToId}>
                    <option value="">Sin asignar</option>
                    {users.filter((user) => user.role === 'TECHNICIAN').map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
                  </select>
                </label>
              ) : null}
              <div className="mt-1 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button disabled={submitting} onClick={close} variant="secondary">Cancelar</Button>
                <Button isLoading={submitting} type="submit">Crear ticket</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
