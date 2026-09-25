import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from '@/app/errors/AppErrorBoundary'

function BrokenView(): never {
  throw new Error('internal implementation detail')
}

describe('AppErrorBoundary', () => {
  it('shows a safe recovery screen without exposing internal details', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <AppErrorBoundary>
        <BrokenView />
      </AppErrorBoundary>,
    )

    expect(screen.getByRole('heading', { name: 'Algo salió mal' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeVisible()
    expect(
      screen.queryByText('internal implementation detail'),
    ).not.toBeInTheDocument()

    consoleError.mockRestore()
  })
})
