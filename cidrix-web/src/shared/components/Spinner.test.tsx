import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Spinner } from '@/shared/components/Spinner'

describe('Spinner', () => {
  it('announces its loading state with a customizable label', () => {
    render(<Spinner label="Cargando tickets" />)

    expect(
      screen.getByRole('status', { name: 'Cargando tickets' }),
    ).toBeVisible()
  })
})
