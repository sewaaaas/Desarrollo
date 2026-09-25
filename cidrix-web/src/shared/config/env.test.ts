import { describe, expect, it } from 'vitest'
import { parseClientEnvironment } from '@/shared/config/env'

describe('parseClientEnvironment', () => {
  it('accepts HTTP URLs and removes trailing slashes', () => {
    expect(
      parseClientEnvironment({
        VITE_API_URL: '  http://localhost:3000/api/v1/  ',
      }),
    ).toEqual({ apiUrl: 'http://localhost:3000/api/v1' })
  })

  it('accepts HTTPS URLs', () => {
    expect(
      parseClientEnvironment({
        VITE_API_URL: 'https://api.cidrix.example/api/v1',
      }),
    ).toEqual({ apiUrl: 'https://api.cidrix.example/api/v1' })
  })

  it.each([undefined, null, '', '   ', 123])(
    'rejects an absent or non-string URL: %s',
    (value) => {
      expect(() =>
        parseClientEnvironment({ VITE_API_URL: value }),
      ).toThrow('VITE_API_URL es obligatoria')
    },
  )

  it('rejects malformed URLs', () => {
    expect(() =>
      parseClientEnvironment({ VITE_API_URL: 'localhost:3000/api/v1' }),
    ).toThrow('VITE_API_URL debe ser una URL válida')
  })

  it('rejects protocols other than HTTP or HTTPS', () => {
    expect(() =>
      parseClientEnvironment({ VITE_API_URL: 'ftp://api.cidrix.example' }),
    ).toThrow('VITE_API_URL debe usar el protocolo http o https')
  })
})
