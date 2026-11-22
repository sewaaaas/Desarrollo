import { describe, expect, it } from 'vitest'
import type { DashboardOverview } from '@/features/dashboard/model/dashboard.types'
import {
  countActiveTickets,
  formatDuration,
  formatUtcCalendarDate,
  getTrendLabelIndexes,
  getTrendMaximum,
  readDashboardPeriod,
} from '@/features/dashboard/model/dashboard.utils'

const overview = {
  summary: {
    total: 21,
    byStatus: {
      OPEN: 2,
      IN_PROGRESS: 3,
      PENDING: 4,
      RESOLVED: 5,
      CLOSED: 6,
      CANCELLED: 1,
    },
  },
} as DashboardOverview

describe('dashboard utils', () => {
  it.each([
    [45, '45 s'],
    [480, '8 min'],
    [8_100, '2 h 15 min'],
    [100_800, '1 d 4 h'],
    [null, 'Sin datos'],
  ] as const)('formatea %s segundos como %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected)
  })

  it('cuenta solo los tres estados activos', () => {
    expect(countActiveTickets(overview)).toBe(9)
  })

  it('formatea YYYY-MM-DD como fecha UTC sin desplazar el día', () => {
    expect(formatUtcCalendarDate('2026-09-30')).toBe('30 sep')
    expect(formatUtcCalendarDate('2026-10-01')).toBe('1 oct')
  })

  it.each(['7d', '30d', '90d'] as const)('acepta el período %s', (period) => {
    expect(readDashboardPeriod(new URLSearchParams(`period=${period}`))).toBe(period)
  })

  it('normaliza un período ausente o inválido a 30d', () => {
    expect(readDashboardPeriod(new URLSearchParams())).toBe('30d')
    expect(readDashboardPeriod(new URLSearchParams('period=abc'))).toBe('30d')
  })

  it('mantiene escala finita cuando todas las series están en cero', () => {
    expect(getTrendMaximum([{ date: '2026-09-30', created: 0, closed: 0 }])).toBe(1)
  })

  it('muestra todos los labels cortos y muestrea series largas', () => {
    expect(getTrendLabelIndexes(7)).toEqual([0, 1, 2, 3, 4, 5, 6])
    const indexes = getTrendLabelIndexes(90)
    expect(indexes).toHaveLength(6)
    expect(indexes[0]).toBe(0)
    expect(indexes.at(-1)).toBe(89)
  })
})
