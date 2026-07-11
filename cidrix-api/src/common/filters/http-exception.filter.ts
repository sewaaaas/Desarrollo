import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorResponse } from '@common/types/api-response.type';

/**
 * HttpExceptionFilter
 *
 * Captura todas las excepciones y las mapea al envelope de error estándar:
 * { error: { code, message, details? } }
 *
 * Los códigos de error son strings semánticos (ej: 'TICKET_NOT_FOUND'),
 * no solo status HTTP — el frontend maneja por código, no por texto.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        code = this.statusToCode(status);
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, unknown>;
        message = typeof res['message'] === 'string'
          ? res['message']
          : Array.isArray(res['message'])
            ? (res['message'] as string[]).join(', ')
            : message;
        code = typeof res['code'] === 'string' ? res['code'] : this.statusToCode(status);
        details = res['details'];
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled exception: ${exception.message}`, exception.stack);
    } else {
      this.logger.error('Unknown exception type', String(exception));
    }

    const body: ApiErrorResponse = {
      error: {
        code,
        message,
        ...(details !== undefined && { details }),
      },
    };

    this.logger.warn(`[${request.method}] ${request.url} → ${status} ${code}`);
    response.status(status).json(body);
  }

  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
    };
    return map[status] ?? 'HTTP_ERROR';
  }
}