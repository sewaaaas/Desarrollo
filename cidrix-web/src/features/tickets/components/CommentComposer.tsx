import { useState } from 'react'
import type { FormEvent } from 'react'
import type {
  CommentVisibility,
  CreateCommentInput,
} from '@/features/tickets/model/ticket.types'
import { Button } from '@/shared/components/Button'

interface CommentComposerProps {
  allowInternal: boolean
  disabledReason?: string
  onSubmit(input: CreateCommentInput): Promise<void>
}

export function CommentComposer({
  allowInternal,
  disabledReason,
  onSubmit,
}: CommentComposerProps) {
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState<CommentVisibility>('PUBLIC')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedContent = content.replace(/\r\n/g, '\n').trim()
    if (!normalizedContent) {
      setError('Escribe un comentario antes de enviarlo.')
      return
    }
    if (normalizedContent.length > 5000) {
      setError('El comentario no puede superar 5000 caracteres.')
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        content: normalizedContent,
        visibility: allowInternal ? visibility : 'PUBLIC',
      })
      setContent('')
      setVisibility('PUBLIC')
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No se pudo publicar el comentario.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (disabledReason) {
    return (
      <div className="rounded-control bg-surface-muted p-4 text-sm text-foreground-muted">
        {disabledReason}
      </div>
    )
  }

  return (
    <form className="rounded-control border border-border p-4" onSubmit={(event) => void handleSubmit(event)}>
      <label className="block text-sm font-semibold text-foreground" htmlFor="ticket-comment">Añadir comentario</label>
      <textarea
        className="mt-2 min-h-28 w-full resize-y rounded-control border border-border bg-surface px-3 py-2 text-sm text-foreground"
        id="ticket-comment"
        maxLength={5000}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Describe una actualización o respuesta…"
        value={content}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
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
        ) : (
          <span className="text-xs text-foreground-muted">Visible para el solicitante y soporte</span>
        )}
        <span className="text-xs text-foreground-muted">{content.length}/5000</span>
      </div>
      {error ? <p className="mt-2 text-sm text-danger" role="alert">{error}</p> : null}
      <div className="mt-3 flex justify-end">
        <Button isLoading={submitting} type="submit">Publicar comentario</Button>
      </div>
    </form>
  )
}
