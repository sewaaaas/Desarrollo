import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Input } from '@/shared/components/Input'

describe('Input', () => {
  it('associates its label and helper text with the input', () => {
    render(
      <Input
        helperText="Usa tu correo corporativo"
        label="Correo electrónico"
        type="email"
      />,
    )

    const input = screen.getByRole('textbox', { name: 'Correo electrónico' })
    expect(input).toHaveAccessibleDescription('Usa tu correo corporativo')
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('exposes validation errors accessibly', () => {
    render(
      <Input
        error="El correo no es válido"
        label="Correo electrónico"
        type="email"
      />,
    )

    const input = screen.getByRole('textbox', { name: 'Correo electrónico' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('El correo no es válido')
  })
})
