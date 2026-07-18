import { registerAs } from '@nestjs/config';

export interface JwtConfig {
  accessSecret: string;
  accessExpiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
}

/**
 * Configuración JWT de CIDRIX.
 * Access token: 15 minutos — corta duración por seguridad.
 * Refresh token: 7 días — permite renovar sin re-login.
 * Secrets distintos — compromiso de uno no compromete el otro.
 */
export const jwtConfig = registerAs(
  'jwt',
  (): JwtConfig => ({
    accessSecret: process.env['JWT_ACCESS_SECRET'] ?? '',
    accessExpiresIn: process.env['JWT_ACCESS_EXPIRES_IN'] ?? '15m',
    refreshSecret: process.env['JWT_REFRESH_SECRET'] ?? '',
    refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d',
  }),
);