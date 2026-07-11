import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app/app.module';
import { AppConfig } from '@config/app.config';

/**
 * Bootstrap de CIDRIX API
 *
 * Configura:
 * - Prefijo global /api/v1 (health excluido)
 * - CORS desde variables de entorno
 * - ValidationPipe global para DTOs
 * - Graceful shutdown para Docker
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const config = configService.get<AppConfig>('app');

  if (!config) {
    throw new Error('Application configuration could not be loaded');
  }

  // Prefijo global — health queda fuera para Docker/LB
  app.setGlobalPrefix(config.apiPrefix, {
    exclude: ['health'],
  });

  // CORS — origins desde env, credentials para httpOnly cookie (refresh token)
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ValidationPipe global — activo desde BE-06 (auth DTOs)
  // Se registra ahora para que todos los DTOs futuros tengan el mismo comportamiento
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );

  // Graceful shutdown — necesario para Docker (BE-02)
  app.enableShutdownHooks();

  await app.listen(config.port);

  logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logger.log(`  CIDRIX API v${config.version}`);
  logger.log(`  Entorno     : ${config.nodeEnv}`);
  logger.log(`  Puerto      : ${config.port}`);
  logger.log(`  Prefijo     : /${config.apiPrefix}`);
  logger.log(`  Health      : http://localhost:${config.port}/health`);
  logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

void bootstrap();