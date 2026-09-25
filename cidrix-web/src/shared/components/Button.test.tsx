import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '@/shared/components/Button'

describe('Button', () => {
  it('renders an accessible button and handles clicks', () => {
    const handleClick = vi.fn()

    render(<Button onClick={handleClick}>Guardar</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('prevents interaction and exposes busy state while loading', () => {
    const handleClick = vi.fn()

    render(
      <Button isLoading onClick={handleClick}>
        Guardar
      </Button>,
    )

    const button = screen.getByRole('button', { name: /guardar/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status', { name: 'Procesando' })).toBeVisible()

    fireEvent.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })
})
