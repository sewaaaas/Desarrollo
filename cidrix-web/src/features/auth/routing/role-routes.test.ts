import { describe, expect, it } from 'vitest'
import {
  getInitialRouteForRole,
  getNavigationItemsForRole,
  resolvePostLoginDestination,
} from '@/features/auth/routing/role-routes'

describe('role routes', () => {
  it.each([
    ['ADMIN', '/dashboard'],
    ['TECHNICIAN', '/dashboard'],
    ['USER', '/tickets'],
  ] as const)('define la ruta inicial de %s', (role, expected) => {
    expect(getInitialRouteForRole(role)).toBe(expected)
  })

  it('oculta Dashboard únicamente a USER', () => {
    expect(getNavigationItemsForRole('USER').map((item) => item.to)).toEqual([
      '/tickets',
      '/notifications',
      '/settings',
    ])
    expect(
      getNavigationItemsForRole('TECHNICIAN').map((item) => item.to),
    ).toContain('/dashboard')
  })

  it('preserva pathname, search y hash de destinos internos conocidos', () => {
    expect(
      resolvePostLoginDestination(
        'USER',
        '/tickets/ticket-1?tab=history#comment-2',
      ),
    ).toBe('/tickets/ticket-1?tab=history#comment-2')
  })

  it.each([
    'https://evil.example/tickets',
    '//evil.example/tickets',
    '/\\evil.example/tickets',
    '/ruta-inexistente',
    42,
    null,
  ])('descarta un destino inválido: %s', (candidate) => {
    expect(resolvePostLoginDestination('ADMIN', candidate)).toBe('/dashboard')
  })

  it('descarta Dashboard como destino de USER', () => {
    expect(resolvePostLoginDestination('USER', '/dashboard')).toBe('/tickets')
  })
})
