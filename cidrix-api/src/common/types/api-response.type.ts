/**
 * Envelope estándar de respuestas de CIDRIX API.
 * Todo endpoint retorna esta estructura — enforced por ResponseInterceptor.
 *
 * Éxito:  { data: T, meta?: PaginationMeta }
 * Error:  { error: ApiError } — manejado por HttpExceptionFilter
 */

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T = unknown> {
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorResponse {
  error: ApiError;
}