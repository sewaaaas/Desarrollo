import { describe, expect, it } from 'vitest'
import { ApiError } from '@/shared/services/api/api-error'
import { canonicalizeTimezone, hasSettingsChanges, isSettingsRequestAborted } from './settings.utils'

describe('settings timezone', () => {
  it.each(['UTC', 'America/Lima', 'America/Bogota', 'Europe/Madrid', 'Pacific/Chatham', 'Etc/GMT+5'])(
    'acepta nombre IANA %s sin lista cerrada', (timezone) => {
      expect(canonicalizeTimezone(timezone)).toBe(new Intl.DateTimeFormat(undefined, { timeZone: timezone }).resolvedOptions().timeZone)
    },
  )

  it('trim y canonicalización de capitalización/alias', () => {
    expect(canonicalizeTimezone('  america/lima  ')).toBe('America/Lima')
    expect(canonicalizeTimezone('US/Eastern')).toBe(canonicalizeTimezone('America/New_York'))
  })

  it.each(['', '   ', 'Invalid/Zone', 'GMT+5', '-05:00', '+05:00', null, undefined, 123, {}])(
    'rechaza valor inválido o no IANA %j', (value) => {
      expect(canonicalizeTimezone(value)).toBeNull()
    },
  )

  it('compara cambios efectivos canonicalizados', () => {
    expect(hasSettingsChanges({ timezone: 'America/Lima' }, ' america/lima ')).toBe(false)
    expect(hasSettingsChanges({ timezone: 'America/New_York' }, 'US/Eastern')).toBe(false)
    expect(hasSettingsChanges({ timezone: 'America/Lima' }, 'Europe/Madrid')).toBe(true)
    expect(hasSettingsChanges({ timezone: 'America/Lima' }, '')).toBe(true)
  })

  it.each([null, undefined, { timezone: 'Invalid/Zone' }])('no fabrica un cambio persistible sin base válida %j', (saved) => {
    expect(hasSettingsChanges(saved, 'UTC')).toBe(false)
  })

  it('reconoce cancelación nativa y ApiError', () => {
    expect(isSettingsRequestAborted(new DOMException('aborted', 'AbortError'))).toBe(true)
    expect(isSettingsRequestAborted(new ApiError({ kind: 'aborted', code: 'ABORT', message: 'abort' }))).toBe(true)
    expect(isSettingsRequestAborted(new Error('network'))).toBe(false)
  })
})
