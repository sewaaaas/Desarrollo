import { Controller, Get } from '@nestjs/common';

interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  environment: string;
}

/**
 * HealthController
 *
 * Endpoint de salud para:
 * - Docker healthcheck (BE-02)
 * - Probes de load balancer
 * - Verificación de CI/CD
 *
 * Excluido del prefijo global /api/v1 y de los guards de auth —
 * debe ser accesible sin token.
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'CIDRIX API',
      version: process.env['APP_VERSION'] ?? '1.0.0',
      timestamp: new Date().toISOString(),
      environment: process.env['NODE_ENV'] ?? 'development',
    };
  }
}