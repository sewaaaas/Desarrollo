import { Module } from '@nestjs/common';
import { TicketsModule } from '@modules/tickets/tickets.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { CommentsRepository } from './comments.repository';

/**
 * CommentsModule
 *
 * Gestiona comentarios (públicos e internos) sobre tickets.
 * DatabaseModule es @Global() — PrismaService disponible sin importarlo.
 * EventEmitterModule es global — EventEmitter2 disponible sin importarlo.
 *
 * Importa TicketsModule (que exporta TicketsService) para reutilizar
 * TicketsService.findOne() en el pipeline de lectura (GET) — ver
 * CommentsService.findAll. El pipeline de escritura (POST) NO reutiliza
 * TicketsService: requiere SELECT ... FOR UPDATE dentro de una transacción
 * propia (ver comments.repository.ts), algo que TicketsService no expone.
 */
@Module({
  imports: [TicketsModule],
  controllers: [CommentsController],
  providers: [CommentsService, CommentsRepository],
  exports: [CommentsService],
})
export class CommentsModule {}
