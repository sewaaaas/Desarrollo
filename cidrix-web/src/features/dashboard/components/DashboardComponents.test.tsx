import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CategoryBreakdown } from '@/features/dashboard/components/CategoryBreakdown'
import { PriorityBreakdown } from '@/features/dashboard/components/PriorityBreakdown'
import { StatusBreakdown } from '@/features/dashboard/components/StatusBreakdown'
import { TrendsChart } from '@/features/dashboard/components/TrendsChart'
import { WorkloadPanel } from '@/features/dashboard/components/WorkloadPanel'
import type { DashboardTrends } from '@/features/dashboard/model/dashboard.types'

const zeroStatuses = {
  OPEN: 0,
  IN_PROGRESS: 0,
  PENDING: 0,
  RESOLVED: 0,
  CLOSED: 0,
  CANCELLED: 0,
}

const zeroPriorities = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }

function makeTrends(days: number, activity = true): DashboardTrends {
  const period = days === 7 ? '7d' : days === 90 ? '90d' : '30d'
  return {
    period,
    timezone: 'UTC',
    dateFrom: '2026-09-01',
    dateTo: '2026-09-30',
    series: Array.from({ length: days }, (_, index) => ({
      date: `2026-09-${String((index % 30) + 1).padStart(2, '0')}`,
      created: activity ? index % 3 : 0,
      closed: activity ? index % 2 : 0,
    })),
  }
}

describe('Dashboard metric components', () => {
  it('Status muestra los seis estados, sus labels y ceros', () => {
    render(<StatusBreakdown counts={zeroStatuses} />)
    const section = screen.getByRole('heading', { name: 'Por estado' }).parentElement!
    expect(within(section).getAllByRole('progressbar')).toHaveLength(6)
    expect(within(section).getByText('Abierto')).toBeVisible()
    expect(within(section).getByText('Cancelado')).toBeVisible()
  })

  it('Priority respeta el orden explícito y conserva ceros', () => {
    render(<PriorityBreakdown counts={zeroPriorities} />)
    const bars = screen.getAllByRole('progressbar')
    expect(bars).toHaveLength(4)
    expect(bars.map((bar) => bar.getAttribute('aria-label'))).toEqual([
      'Baja: 0',
      'Media: 0',
      'Alta: 0',
      'Crítica: 0',
    ])
  })

  it('Category muestra sin categoría, inactiva, eliminada y vacío', () => {
    const { rerender } = render(
      <CategoryBreakdown
        categories={[
          { categoryId: null, categoryName: 'Sin categoría', isActive: false, isDeleted: false, count: 2 },
          { categoryId: 'cat-1', categoryName: 'Legado', isActive: false, isDeleted: true, count: 1 },
        ]}
      />,
    )
    expect(screen.getByText('Sin categoría')).toBeVisible()
    expect(screen.getByText('Inactiva')).toBeVisible()
    expect(screen.getByText('Eliminada')).toBeVisible()

    rerender(<CategoryBreakdown categories={[]} />)
    expect(screen.getByText('Aún no hay tickets por categoría.')).toBeVisible()
  })

  it('Category permite que el card contenga nombres largos sin ampliar el grid', () => {
    const categoryName = 'X'.repeat(80)
    render(
      <CategoryBreakdown
        categories={[
          { categoryId: 'cat-long', categoryName, isActive: true, isDeleted: false, count: 12 },
        ]}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Por categoría' }).parentElement).toHaveClass('min-w-0')
    expect(screen.getByText(categoryName)).toBeVisible()
    expect(screen.getByText('12')).toBeVisible()
  })

  it('Workload muestra carga por estado, sin asignar y usuarios no activos', () => {
    render(
      <WorkloadPanel
        workload={{
          activeStatuses: ['OPEN', 'IN_PROGRESS', 'PENDING'],
          unassignedTickets: 4,
          assignees: [{
            assigneeId: 'tech-1',
            assigneeName: 'Técnico histórico',
            role: 'TECHNICIAN',
            status: 'INACTIVE',
            activeTickets: 6,
            byStatus: { OPEN: 1, IN_PROGRESS: 2, PENDING: 3 },
          }],
        }}
      />,
    )
    expect(screen.getByText('Sin asignar:').parentElement).toHaveTextContent('4')
    expect(screen.getAllByText('Técnico histórico')).not.toHaveLength(0)
    expect(screen.getAllByText('Inactivo')).not.toHaveLength(0)
    expect(screen.getAllByText('6')).not.toHaveLength(0)
  })

  it('Workload presenta el empty state correcto', () => {
    render(
      <WorkloadPanel workload={{ activeStatuses: ['OPEN', 'IN_PROGRESS', 'PENDING'], unassignedTickets: 0, assignees: [] }} />,
    )
    expect(screen.getByText('No hay tickets activos asignados.')).toBeVisible()
  })
})

describe('TrendsChart', () => {
  it.each([7, 90])('renderiza %s puntos con leyenda y nombre accesible', (days) => {
    const { container } = render(<TrendsChart trends={makeTrends(days)} />)
    expect(screen.getByText(/Creados \(/)).toBeVisible()
    expect(screen.getByText(/Cerrados \(/)).toBeVisible()
    expect(screen.getByRole('img', { name: new RegExp(`últimos ${days} días`) })).toBeVisible()
    expect(container.querySelectorAll('polyline')).toHaveLength(2)
  })

  it('mantiene el gráfico estable y comunica todo-cero', () => {
    const { container } = render(<TrendsChart trends={makeTrends(7, false)} />)
    expect(screen.getByText('Sin actividad en este período.')).toBeVisible()
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })
})
