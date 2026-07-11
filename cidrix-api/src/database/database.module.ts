import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * DatabaseModule
 *
 * Módulo global que expone PrismaService a toda la aplicación.
 * @Global() elimina la necesidad de importarlo en cada módulo feature —
 * cualquier módulo puede inyectar PrismaService directamente.
 *
 * Se registra una sola vez en AppModule.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}