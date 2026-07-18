import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * UsersModule
 *
 * Gestiona el ciclo de vida de usuarios dentro de una organización.
 * DatabaseModule es @Global() — PrismaService disponible sin importarlo.
 * ConfigModule es @Global() — ConfigService disponible sin importarlo.
 */
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}