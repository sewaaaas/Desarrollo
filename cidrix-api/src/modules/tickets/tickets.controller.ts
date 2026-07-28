import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { TicketFiltersDto } from './dto/ticket-filters.dto';
import { TicketResponseDto, PaginatedTicketsDto } from './dto/ticket-response.dto';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';

/**
 * TicketsController
 *
 * Roles por endpoint:
 *   POST   /tickets              → ADMIN, TECHNICIAN, USER
 *   GET    /tickets              → ADMIN, TECHNICIAN, USER (USER ve solo los suyos)
 *   GET    /tickets/:id          → ADMIN, TECHNICIAN, USER (USER ve solo los suyos)
 *   PATCH  /tickets/:id          → ADMIN, TECHNICIAN (USER no puede editar)
 *   PATCH  /tickets/:id/assign   → ADMIN únicamente
 *   PATCH  /tickets/:id/status   → ADMIN, TECHNICIAN
 */
@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // ---------------------------------------------------------------------------
  // POST /tickets — Crear ticket
  // ---------------------------------------------------------------------------

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.USER)
  async create(
    @CurrentUser() currentUser: RequestUser,
    @Body() dto: CreateTicketDto,
  ): Promise<TicketResponseDto> {
    return this.ticketsService.create(currentUser, dto);
  }

  // ---------------------------------------------------------------------------
  // GET /tickets — Listar tickets
  // ---------------------------------------------------------------------------

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.USER)
  async findAll(
    @CurrentUser() currentUser: RequestUser,
    @Query() filters: TicketFiltersDto,
  ): Promise<PaginatedTicketsDto> {
    return this.ticketsService.findAll(currentUser, filters);
  }

  // ---------------------------------------------------------------------------
  // GET /tickets/:id — Detalle del ticket
  // ---------------------------------------------------------------------------

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.USER)
  async findOne(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
  ): Promise<TicketResponseDto> {
    return this.ticketsService.findOne(currentUser, id);
  }

  // ---------------------------------------------------------------------------
  // PATCH /tickets/:id — Actualizar ticket
  // ---------------------------------------------------------------------------

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.TECHNICIAN)
  async update(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
  ): Promise<TicketResponseDto> {
    return this.ticketsService.update(currentUser, id, dto);
  }

  // ---------------------------------------------------------------------------
  // PATCH /tickets/:id/assign — Asignar técnico
  // ---------------------------------------------------------------------------

  @Patch(':id/assign')
  @Roles(UserRole.ADMIN)
  async assign(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
  ): Promise<TicketResponseDto> {
    return this.ticketsService.assign(currentUser, id, dto);
  }

  // ---------------------------------------------------------------------------
  // PATCH /tickets/:id/status — Cambiar estado
  // ---------------------------------------------------------------------------

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.TECHNICIAN)
  async updateStatus(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
  ): Promise<TicketResponseDto> {
    return this.ticketsService.updateStatus(currentUser, id, dto);
  }
}