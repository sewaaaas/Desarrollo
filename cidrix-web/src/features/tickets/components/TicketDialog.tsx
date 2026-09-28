import { useEffect } from 'react'
import type { PropsWithChildren } from 'react'
import { Button } from '@/shared/components/Button'

interface TicketDialogProps extends PropsWithChildren {
  labelledBy: string
  onClose(): void
}

export function TicketDialog({
  children,
  labelledBy,
  onClose,
}: TicketDialogProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      aria-labelledby={labelledBy}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4"
      role="dialog"
    >
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-card bg-surface p-5 shadow-overlay sm:p-6">
        <div className="flex justify-end">
          <Button aria-label="Cerrar" onClick={onClose} size="sm" variant="secondary">
            Cerrar
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}
