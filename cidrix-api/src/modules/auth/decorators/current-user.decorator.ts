import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { RequestUser } from '../types/jwt-payload.type';

/**
 * @CurrentUser()
 *
 * Decorador que extrae el usuario autenticado de req.user.
 * Disponible en cualquier controller protegido por JwtAuthGuard.
 *
 * Uso:
 *   @Get('me')
 *   @UseGuards(JwtAuthGuard)
 *   getMe(@CurrentUser() user: RequestUser) { ... }
 *
 * Nota: Se moverá a src/common/decorators/ cuando otros módulos
 * lo necesiten (Sprint 2).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: RequestUser }>();
    return request.user;
  },
);