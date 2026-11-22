import { describe, expect, it } from 'vitest'
import { formatNotificationDate, notificationFiltersToSearchParams, readNotificationFilters } from './notification.utils'

describe('notification URL', () => {
  it.each(['all', 'unread', 'read'] as const)('conserva %s y página válida', (filter) => {
    expect(readNotificationFilters(new URLSearchParams(`filter=${filter}&page=2`))).toEqual({ filter, page: 2 })
  })

  it('normaliza filtro inválido', () => {
    expect(readNotificationFilters(new URLSearchParams('filter=evil'))).toEqual({ filter: 'all', page: 1 })
  })

  it.each(['', '0', '-1', '1.5', 'abc', 'Infinity', '999999999999999999999'])('normaliza página %s a 1', (page) => {
    expect(readNotificationFilters(new URLSearchParams(`page=${page}`)).page).toBe(1)
  })

  it('serializa filtro y página', () => {
    expect(notificationFiltersToSearchParams({ filter: 'unread', page: 1 }).toString()).toBe('filter=unread&page=1')
  })

  it('formatea timestamps y maneja fecha inválida', () => {
    expect(formatNotificationDate('2026-10-10T18:00:00.000Z')).not.toBe('Fecha no disponible')
    expect(formatNotificationDate('invalid')).toBe('Fecha no disponible')
  })
})
