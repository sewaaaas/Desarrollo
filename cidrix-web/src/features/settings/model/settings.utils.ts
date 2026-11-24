import { ApiError } from '@/shared/services/api/api-error'
import type { OrganizationSettings } from './settings.types'

export function canonicalizeTimezone(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const timezone = value.trim()
  // Intl moderno también acepta offsets: este campo pide nombres IANA.
  if (!timezone || /^[+-]/.test(timezone)) return null
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone: timezone }).resolvedOptions().timeZone
  } catch {
    return null
  }
}

export function hasSettingsChanges(saved: OrganizationSettings | null | undefined, draft: string): boolean {
  if (!saved) return false
  const confirmed = canonicalizeTimezone(saved.timezone)
  if (!confirmed) return false
  return canonicalizeTimezone(draft) !== confirmed
}

export function isSettingsRequestAborted(error: unknown): boolean {
  return (error instanceof ApiError && error.kind === 'aborted') ||
    (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError')
}

export function settingsErrorMessage(error: unknown, operation: 'get' | 'save'): string {
  if (error instanceof ApiError) {
    if (error.status === 400) return 'La zona horaria no fue aceptada. Revisa el valor e inténtalo de nuevo.'
    if (error.status === 403) return operation === 'save'
      ? 'No tienes permisos para modificar esta configuración.'
      : 'No tienes permisos para consultar esta configuración.'
    if (error.status === 404) return 'La configuración de la organización no está disponible.'
    if (error.status === 409) return 'La configuración no se puede actualizar en este momento. Contacta al administrador.'
    if (error.kind === 'network') return 'No pudimos conectar con el servidor. Inténtalo de nuevo.'
    if (error.status && error.status >= 500) return 'El servicio no está disponible temporalmente. Inténtalo de nuevo.'
  }
  return operation === 'get'
    ? 'No se pudo cargar la configuración. Inténtalo de nuevo.'
    : 'No se pudo guardar la configuración. Inténtalo de nuevo.'
}
