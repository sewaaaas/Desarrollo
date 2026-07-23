import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '@common/decorators/roles.decorator';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';
import { Request } from 'express';

/**
 * RolesGuard
 *
 * Verifica que el usuario autenticado tenga al menos uno de los roles
 * requeridos por el endpoint mediante @Roles().
 *
 * SIEMPRE debe usarse junto con JwtAuthGuard — RolesGuard asume que
 * req.user ya fue inyectado por JwtAuthGuard.
 *
 * Si el endpoint no tiene @Roles(), el guard lo permite (sin restricción de rol).
 *
 * Uso:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles(UserRole.ADMIN)
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Sin @Roles() → acceso libre para cualquier usuario autenticado
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user: RequestUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException(
        `Acceso denegado. Se requiere uno de los siguientes roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}