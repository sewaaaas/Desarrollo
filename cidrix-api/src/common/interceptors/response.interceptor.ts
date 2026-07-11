import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '@common/types/api-response.type';

/**
 * ResponseInterceptor
 *
 * Envuelve automáticamente toda respuesta exitosa en { data: T }.
 * Aplicado globalmente en AppModule — ningún controller necesita hacerlo.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({ data })),
    );
  }
}