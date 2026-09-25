import type { ApiErrorKind } from '@/shared/services/api/api.types'

interface ApiErrorOptions {
  cause?: unknown
  code: string
  details?: unknown
  kind: ApiErrorKind
  message: string
  status?: number
}

export class ApiError extends Error {
  readonly code: string
  readonly details?: unknown
  readonly kind: ApiErrorKind
  readonly status?: number

  constructor({
    cause,
    code,
    details,
    kind,
    message,
    status,
  }: ApiErrorOptions) {
    super(message, { cause })
    this.name = 'ApiError'
    this.code = code
    this.details = details
    this.kind = kind
    this.status = status
  }
}
