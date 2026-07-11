import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { appConfig, validationSchema } from '@config/app.config';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { ResponseInterceptor } from '@common/interceptors/response.interceptor';
import { HealthController } from './health.controller';

/**
 * AppModule — Módulo raíz de CIDRIX API
 *
 * Responsabilidades:
 *  1. Cargar y validar variables de entorno (ConfigModule + Joi)
 *  2. Registrar interceptor global (ResponseInterceptor)
 *  3. Registrar filtro global de excepciones (HttpExceptionFilter)
 *  4. Declarar HealthController
 *
 * Módulos que se agregarán por sprint:
 *  - BE-03/04: DatabaseModule (Prisma)
 *  - BE-06:    AuthModule
 *  - Sprint 2: TicketsModule, CategoriesModule
 *  - Sprint 3: CommentsModule, AttachmentsModule, UsersModule
 *  - Sprint 4: DashboardModule, NotificationsModule, SettingsModule
 *
 * Regla de arquitectura: AppModule NO contiene lógica de negocio.
 * Es un módulo de wiring puro.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
      expandVariables: true,
    }),
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}