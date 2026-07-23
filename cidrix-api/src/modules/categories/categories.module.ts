import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

/**
 * CategoriesModule
 *
 * Gestiona categorías dentro de una organización.
 * DatabaseModule es @Global() — PrismaService disponible sin importarlo.
 */
@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}