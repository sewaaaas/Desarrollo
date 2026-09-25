import { ApiError } from '@/shared/services/api/api-error'
import type { AuthSafeError } from '@/features/auth/model/auth.types'

const LOGIN_CREDENTIALS_ERROR: AuthSafeError = {
  code: 'AUTH_CREDENTIALS_REJECTED',
  kind: 'credentials',
  message:
    'No pudimos iniciar sesión. Verifica tus credenciales o contacta al administrador.',
}

const SERVICE_UNAVAILABLE_ERROR: AuthSafeError = {
  code: 'AUTH_SERVICE_UNAVAILABLE',
  kind: 'network',
  message:
    'El servicio no está disponible temporalmente. Inténtalo nuevamente.',
}

const UNEXPECTED_AUTH_ERROR: AuthSafeError = {
  code: 'AUTH_UNEXPECTED_ERROR',
  kind: 'unexpected',
  message: 'No pudimos completar la operación. Inténtalo nuevamente.',
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}

export function toLoginSafeError(error: unknown): AuthSafeError {
  if (isUnauthorizedError(error)) {
    return LOGIN_CREDENTIALS_ERROR
  }

  if (error instanceof ApiError) {
    if (error.kind === 'network' || (error.status && error.status >= 500)) {
      return SERVICE_UNAVAILABLE_ERROR
    }

    if (error.status === 403) {
      return {
        code: 'AUTH_FORBIDDEN',
        kind: 'forbidden',
        message: 'No tienes permisos para completar esta operación.',
      }
    }
  }

  return UNEXPECTED_AUTH_ERROR
}

export function toSessionSafeError(error: unknown): AuthSafeError {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return {
        code: 'AUTH_SESSION_FORBIDDEN',
        kind: 'forbidden',
        message: 'No fue posible verificar el acceso a tu sesión.',
      }
    }

    if (error.kind === 'network') {
      return SERVICE_UNAVAILABLE_ERROR
    }

    if (error.kind === 'protocol' || (error.status && error.status >= 500)) {
      return {
        ...SERVICE_UNAVAILABLE_ERROR,
        kind: 'server',
      }
    }
  }

  return UNEXPECTED_AUTH_ERROR
}
