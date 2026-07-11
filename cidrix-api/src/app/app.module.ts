import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { appConfig, validationSchema } from '@config/app.config';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { ResponseInterceptor } from '@common/interceptors/response.interceptor';
import { DatabaseModule } from '@database/database.module';
import { HealthController } from './health.controller';

/**
 * AppModule — Módulo raíz de CIDRIX API
 *
 * Módulos registrados:
 *  - ConfigModule  : variables de entorno validadas con Joi (global)
 *  - DatabaseModule: PrismaService disponible en toda la app (global)
 *
 * Módulos que se agregarán por sprint:
 *  - BE-06:    AuthModule
 *  - Sprint 2: TicketsModule, CategoriesModule
 *  - Sprint 3: CommentsModule, AttachmentsModule, UsersModule
 *  - Sprint 4: DashboardModule, NotificationsModule, SettingsModule
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
    DatabaseModule,
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