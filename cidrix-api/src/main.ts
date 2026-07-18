import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser') as typeof import('cookie-parser');
import { AppModule } from './app/app.module';
import { AppConfig } from '@config/app.config';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const config = configService.get<AppConfig>('app');

  if (!config) {
    throw new Error('Application configuration could not be loaded');
  }

  // Cookie parser — requerido para leer httpOnly cookie del refresh token
  app.use(cookieParser());

  // Prefijo global — health queda fuera para Docker/LB
  app.setGlobalPrefix(config.apiPrefix, {
    exclude: ['health'],
  });

  // CORS — credentials: true requerido para httpOnly cookies
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ValidationPipe global
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

  // Graceful shutdown para Docker
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