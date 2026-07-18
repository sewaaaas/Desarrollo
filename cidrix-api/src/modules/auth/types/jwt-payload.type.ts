import { UserRole } from '@prisma/client';

/**
 * Payload del JWT de CIDRIX.
 *
 * Incluye organizationId para evitar round-trips a DB en cada request.
 * El guard lo inyecta directamente en req.user.
 *
 * sub: userId — convención estándar JWT (RFC 7519)
 */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  organizationId: string;
}

/**
 * Usuario inyectado por JwtAuthGuard en req.user.
 * Disponible via @CurrentUser() en cualquier controller protegido.
 */
export interface RequestUser {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
}