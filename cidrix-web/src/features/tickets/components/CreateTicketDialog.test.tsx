import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CreateTicketDialog } from '@/features/tickets/components/CreateTicketDialog'
import type { Ticket } from '@/features/tickets/model/ticket.types'
import { ApiError } from '@/shared/services/api/api-error'

const createdTicket = {
  id: 'ticket-1',
  ticketNumber: 'TKT-0100',
} as Ticket

function renderDialog(onCreate = vi.fn().mockResolvedValue(createdTicket)) {
  const onCreated = vi.fn()
  render(
    <CreateTicketDialog
      categories={[]}
      onCreate={onCreate}
      onCreated={onCreated}
      role="USER"
      users={[]}
    />,
  )
  return { onCreate, onCreated }
}

function openAndFill() {
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo ticket' }))
  fireEvent.change(screen.getByLabelText('Título'), {
    target: { value: 'Problema de acceso' },
  })
  fireEvent.change(screen.getByLabelText(/^Descripción/), {
    target: { value: 'No puedo acceder desde esta mañana.' },
  })
}

describe('CreateTicketDialog', () => {
  it('abre con labels, atrapa Escape y devuelve foco al CTA', async () => {
    renderDialog()
    const trigger = screen.getByRole('button', { name: 'Nuevo ticket' })
    fireEvent.click(trigger)

    expect(screen.getByRole('dialog', { name: 'Crear ticket' })).toBeVisible()
    expect(screen.getByLabelText('Título')).toBeVisible()
    expect(screen.getByLabelText(/^Descripción/)).toBeVisible()
    expect(screen.getByLabelText('Prioridad')).toBeVisible()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('valida título requerido, máximo y descripción mínima', async () => {
    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo ticket' }))
    fireEvent.change(screen.getByLabelText('Título'), {
      target: { value: 'x'.repeat(256) },
    })
    fireEvent.change(screen.getByLabelText(/^Descripción/), {
      target: { value: 'corta' },
    })
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)

    expect(await screen.findByText('El título no puede superar 255 caracteres.')).toBeVisible()
    expect(screen.getByText('La descripción debe tener al menos 10 caracteres.')).toBeVisible()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: '   ' } })
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
    expect(await screen.findByText('El título es obligatorio.')).toBeVisible()
  })

  it('bloquea doble submit, informa éxito y resetea el formulario', async () => {
    let resolveCreate: ((ticket: Ticket) => void) | undefined
    const onCreate = vi.fn(
      () =>
        new Promise<Ticket>((resolve) => {
          resolveCreate = resolve
        }),
    )
    const { onCreated } = renderDialog(onCreate)
    openAndFill()
    const form = screen.getByRole('dialog').querySelector('form')!

    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(onCreate).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: /Crear ticket/ })).toBeDisabled()
    resolveCreate?.(createdTicket)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onCreated).toHaveBeenCalledWith(createdTicket)

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo ticket' }))
    expect(screen.getByLabelText('Título')).toHaveValue('')
    expect(screen.getByLabelText(/^Descripción/)).toHaveValue('')
  })

  it('mantiene el diálogo y muestra un error seguro si falla el alta', async () => {
    const onCreate = vi.fn().mockRejectedValue(
      new ApiError({
        code: 'HTTP_500',
        kind: 'http',
        message: 'detalle interno',
        status: 500,
      }),
    )
    renderDialog(onCreate)
    openAndFill()
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos crear el ticket. Inténtalo nuevamente.',
    )
    expect(screen.getByRole('dialog')).toBeVisible()
  })
})
