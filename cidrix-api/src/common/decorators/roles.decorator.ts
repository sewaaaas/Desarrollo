import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * @Roles(...roles)
 *
 * Decorador que define qué roles pueden acceder a un endpoint.
 * Requiere RolesGuard activo en el controller o globalmente.
 *
 * Uso:
 *   @Roles(UserRole.ADMIN, UserRole.TECHNICIAN)
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Patch(':id/assign')
 *   assign(...) {}
 */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);