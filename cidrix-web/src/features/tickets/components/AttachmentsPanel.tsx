import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type {
  Attachment,
  CommentVisibility,
} from '@/features/tickets/model/ticket.types'
import { Button } from '@/shared/components/Button'

const ACCEPTED_FILE_TYPES = '.pdf,.png,.jpg,.jpeg,.webp,.txt,.log,.csv'
const dateFormatter = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface AttachmentsPanelProps {
  allowDelete: boolean
  allowInternal: boolean
  attachments: Attachment[]
  canUpload: boolean
  error: string | null
  loading: boolean
  onDelete(attachment: Attachment): Promise<void>
  onDownload(attachment: Attachment): Promise<void>
  onRetry(): void
  onUpload(file: File, visibility: CommentVisibility): Promise<void>
}

export function AttachmentsPanel({
  allowDelete,
  allowInternal,
  attachments,
  canUpload,
  error,
  loading,
  onDelete,
  onDownload,
  onRetry,
  onUpload,
}: AttachmentsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [visibility, setVisibility] = useState<CommentVisibility>('PUBLIC')
  const [operationError, setOperationError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const file = fileInputRef.current?.files?.[0]
    if (!file || file.size === 0) {
      setOperationError('Selecciona un archivo no vacío.')
      return
    }

    const form = event.currentTarget

    setOperationError(null)
    setUploading(true)
    try {
      await onUpload(file, allowInternal ? visibility : 'PUBLIC')
      form.reset()
      setVisibility('PUBLIC')
    } catch (uploadError: unknown) {
      setOperationError(uploadError instanceof Error ? uploadError.message : 'No se pudo subir el archivo.')
    } finally {
      setUploading(false)
    }
  }

  async function runAttachmentAction(id: string, action: () => Promise<void>) {
    setOperationError(null)
    setActiveId(id)
    try {
      await action()
    } catch (actionError: unknown) {
      setOperationError(actionError instanceof Error ? actionError.message : 'No se pudo completar la operación.')
    } finally {
      setActiveId(null)
    }
  }

  return (
    <div>
      {canUpload ? (
        <form className="mb-5 rounded-control border border-border p-4" onSubmit={(event) => void handleUpload(event)}>
          <label className="block text-sm font-semibold text-foreground" htmlFor="ticket-attachment">Adjuntar archivo</label>
          <input
            accept={ACCEPTED_FILE_TYPES}
            className="mt-2 block w-full text-sm text-foreground-muted file:mr-3 file:rounded-control file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:font-semibold file:text-primary"
            id="ticket-attachment"
            ref={fileInputRef}
            required
            type="file"
          />
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            {allowInternal ? (
              <label className="text-sm text-foreground-muted">
                Visibilidad{' '}
                <select
                  className="ml-2 rounded-control border border-border bg-surface px-2 py-1.5 text-foreground"
                  onChange={(event) => setVisibility(event.target.value as CommentVisibility)}
                  value={visibility}
                >
                  <option value="PUBLIC">Público</option>
                  <option value="INTERNAL">Interno</option>
                </select>
              </label>
            ) : <span className="text-xs text-foreground-muted">El archivo será público.</span>}
            <Button isLoading={uploading} size="sm" type="submit">Subir archivo</Button>
          </div>
          <p className="mt-2 text-xs text-foreground-muted">PDF, imágenes, TXT, LOG o CSV. Los límites finales los valida el servidor.</p>
        </form>
      ) : null}

      {operationError ? <p className="mb-4 text-sm text-danger" role="alert">{operationError}</p> : null}
      {loading && attachments.length === 0 ? <p aria-live="polite" className="py-8 text-center text-sm text-foreground-muted">Cargando archivos…</p> : null}
      {error && attachments.length === 0 ? (
        <div className="py-8 text-center" role="alert">
          <p className="text-sm text-danger">{error}</p>
          <Button className="mt-3" onClick={onRetry} size="sm" variant="secondary">Reintentar archivos</Button>
        </div>
      ) : null}
      {!loading && !error && attachments.length === 0 ? <p className="py-8 text-center text-sm text-foreground-muted">No hay archivos adjuntos.</p> : null}
      {attachments.length > 0 ? (
        <ul className="divide-y divide-border">
          {attachments.map((attachment) => (
            <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between" key={attachment.id}>
              <div className="min-w-0">
                <p className="break-all text-sm font-semibold text-foreground">{attachment.originalName}</p>
                <p className="mt-1 text-xs text-foreground-muted">
                  {formatBytes(attachment.sizeBytes)} · {attachment.uploadedBy.name} ·{' '}
                  <time dateTime={attachment.createdAt}>{dateFormatter.format(new Date(attachment.createdAt))}</time>
                </p>
                {attachment.visibility === 'INTERNAL' ? <span className="mt-2 inline-flex rounded-full bg-surface-muted px-2 py-1 text-xs font-semibold text-foreground-muted">Interno</span> : null}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  disabled={activeId !== null}
                  isLoading={activeId === attachment.id}
                  onClick={() => void runAttachmentAction(attachment.id, () => onDownload(attachment))}
                  size="sm"
                  variant="secondary"
                >Descargar</Button>
                {allowDelete ? (
                  <Button
                    disabled={activeId !== null}
                    onClick={() => {
                      if (window.confirm(`¿Eliminar ${attachment.originalName}?`)) {
                        void runAttachmentAction(attachment.id, () => onDelete(attachment))
                      }
                    }}
                    size="sm"
                    variant="danger"
                  >Eliminar</Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {error && attachments.length > 0 ? <p className="mt-4 text-sm text-danger" role="alert">{error}</p> : null}
    </div>
  )
}
