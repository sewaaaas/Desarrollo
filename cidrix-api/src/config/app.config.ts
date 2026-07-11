import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  version: string;
  corsOrigins: string[];
  bcryptSaltRounds: number;
}

/**
 * Configuración de la aplicación.
 * registerAs() permite accederla tipada con ConfigService.get<AppConfig>('app').
 */
export const appConfig = registerAs(
  'app',
  (): AppConfig => ({
    nodeEnv: process.env['NODE_ENV'] ?? 'development',
    port: parseInt(process.env['PORT'] ?? '3000', 10),
    apiPrefix: process.env['API_PREFIX'] ?? 'api/v1',
    version: process.env['APP_VERSION'] ?? '1.0.0',
    corsOrigins: (process.env['CORS_ORIGINS'] ?? 'http://localhost:5173').split(','),
    bcryptSaltRounds: parseInt(process.env['BCRYPT_SALT_ROUNDS'] ?? '10', 10),
  }),
);

/**
 * Schema Joi de validación de variables de entorno.
 * Si una variable requerida falta o es inválida, la app NO arranca.
 * Se irán agregando variables a medida que se implementen módulos.
 */
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  APP_VERSION: Joi.string().default('1.0.0'),
  CORS_ORIGINS: Joi.string().default('http://localhost:5173'),
  BCRYPT_SALT_ROUNDS: Joi.number().min(8).max(14).default(10),

  // Database — obligatorio desde BE-03
  DATABASE_URL: Joi.string().optional(),

  // JWT — obligatorio desde BE-06
  JWT_ACCESS_SECRET: Joi.string().min(32).optional(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).optional(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Storage — Sprint 3
  STORAGE_DRIVER: Joi.string().valid('local', 's3').default('local'),
  STORAGE_LOCAL_PATH: Joi.string().default('./uploads'),
});