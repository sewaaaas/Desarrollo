import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TicketTimelineService } from './ticket-timeline.service';

/**
 * TicketsModule
 *
 * Núcleo funcional de CIDRIX.
 * DatabaseModule es @Global() — PrismaService disponible sin importarlo.
 * EventEmitterModule es global — EventEmitter2 disponible sin importarlo.
 */
@Module({
  controllers: [TicketsController],
  providers: [TicketsService, TicketTimelineService],
  exports: [TicketsService],
})
export class TicketsModule {}
