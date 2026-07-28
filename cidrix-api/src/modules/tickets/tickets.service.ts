import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, TicketHistoryAction, TicketPriority, TicketStatus, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';
import { EVENTS } from '@integrations/events/event-types';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { TicketFiltersDto, SortOrder } from './dto/ticket-filters.dto';
import {
  PaginatedTicketsDto,
  TicketCategoryDto,
  TicketResponseDto,
  TicketUserDto,
} from './dto/ticket-response.dto';

// Transiciones de estado permitidas
const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.OPEN]: [TicketStatus.IN_PROGRESS, TicketStatus.CANCELLED],
  [TicketStatus.IN_PROGRESS]: [TicketStatus.PENDING, TicketStatus.RESOLVED, TicketStatus.CANCELLED],
  [TicketStatus.PENDING]: [TicketStatus.IN_PROGRESS, TicketStatus.CANCELLED],
  [TicketStatus.RESOLVED]: [TicketStatus.IN_PROGRESS, TicketStatus.CLOSED],
  [TicketStatus.CLOSED]: [],
  [TicketStatus.CANCELLED]: [],
};

// Estados que requieren técnico asignado
const REQUIRES_ASSIGNEE: TicketStatus[] = [
  TicketStatus.IN_PROGRESS,
  TicketStatus.PENDING,
  TicketStatus.RESOLVED,
];

// Estados terminales — no permiten modificaciones
const TERMINAL_STATUSES: TicketStatus[] = [
  TicketStatus.CLOSED,
  TicketStatus.CANCELLED,
];

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ---------------------------------------------------------------------------
  // Crear ticket
  // ---------------------------------------------------------------------------

  async create(
    currentUser: RequestUser,
    dto: CreateTicketDto,
  ): Promise<TicketResponseDto> {
    const { organizationId, role } = currentUser;

    /**
     * USER no puede establecer categoryId ni assignedToId.
     * La categorización y asignación son responsabilidad de TECHNICIAN y ADMIN.
     * Se responde con 403 FORBIDDEN explícito — no se ignora silenciosamente.
     */
    if (role === UserRole.USER && dto.categoryId) {
      throw new ForbiddenException(
        'Los usuarios no pueden categorizar tickets. Contacta a un técnico o administrador.',
      );
    }

    if (role === UserRole.USER && dto.assignedToId) {
      throw new ForbiddenException(
        'Los usuarios no pueden asignar técnicos al crear un ticket.',
      );
    }

    const effectiveCategoryId = dto.categoryId ?? null;
    const effectiveAssignedToId = dto.assignedToId ?? null;

    // Validar categoría si aplica
    if (effectiveCategoryId) {
      await this.validateCategory(organizationId, effectiveCategoryId);
    }

    // Validar técnico asignado si aplica
    if (effectiveAssignedToId) {
      await this.validateAssignee(organizationId, effectiveAssignedToId);
    }

    const now = new Date();

    const ticket = await this.prisma.$transaction(async (tx) => {
      // Incremento atómico del contador
      const counter = await tx.ticketCounter.upsert({
        where: { organizationId },
        update: { lastNumber: { increment: 1 } },
        create: { organizationId, lastNumber: 1 },
      });

      const created = await tx.ticket.create({
        data: {
          organizationId,
          number: counter.lastNumber,
          title: dto.title,
          description: dto.description,
          priority: dto.priority ?? TicketPriority.MEDIUM,
          status: TicketStatus.OPEN,
          version: 1,
          createdById: currentUser.id,
          assignedToId: effectiveAssignedToId,
          categoryId: effectiveCategoryId,
        },
        include: this.defaultInclude(),
      });

      await tx.ticketHistory.create({
        data: {
          ticketId: created.id,
          organizationId,
          changedById: currentUser.id,
          action: TicketHistoryAction.CREATED,
          changes: {
            title: { from: null, to: dto.title },
            priority: { from: null, to: dto.priority ?? TicketPriority.MEDIUM },
            status: { from: null, to: TicketStatus.OPEN },
            assignedToId: { from: null, to: effectiveAssignedToId },
            categoryId: { from: null, to: effectiveCategoryId },
          } as Prisma.InputJsonValue,
          occurredAt: now,
        },
      });

      return created;
    });

    this.eventEmitter.emit(EVENTS.TICKET_CREATED, {
      ticketId: ticket.id,
      ticketNumber: this.formatNumber(ticket.number),
      organizationId,
      priority: ticket.priority,
      categoryId: ticket.categoryId,
      createdBy: currentUser.id,
      assignedTo: ticket.assignedToId,
      slaPolicyId: null,
      occurredAt: now,
    });

    this.logger.log(`Ticket creado: ${this.formatNumber(ticket.number)} (org: ${organizationId})`);

    return this.mapToDto(ticket);
  }

  // ---------------------------------------------------------------------------
  // Listar tickets
  // ---------------------------------------------------------------------------

  async findAll(
    currentUser: RequestUser,
    filters: TicketFiltersDto,
  ): Promise<PaginatedTicketsDto> {
    const { organizationId, role, id: userId } = currentUser;
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { organizationId };

    // USER solo ve sus propios tickets
    if (role === UserRole.USER) {
      where['createdById'] = userId;
    }

    if (filters.status)       where['status']       = filters.status;
    if (filters.priority)     where['priority']     = filters.priority;
    if (filters.categoryId)   where['categoryId']   = filters.categoryId;
    if (filters.assignedToId) where['assignedToId'] = filters.assignedToId;
    if (filters.createdById)  where['createdById']  = filters.createdById;

    if (filters.dateFrom || filters.dateTo) {
      where['createdAt'] = {
        ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
        ...(filters.dateTo   && { lte: new Date(filters.dateTo) }),
      };
    }

    if (filters.search) {
      where['OR'] = [
        { title: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const sortBy    = filters.sortBy    ?? 'createdAt';
    const sortOrder = filters.sortOrder ?? SortOrder.DESC;

    const [tickets, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      data: tickets.map((t) => this.mapToDto(t)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Obtener ticket por ID
  // ---------------------------------------------------------------------------

  async findOne(
    currentUser: RequestUser,
    id: string,
  ): Promise<TicketResponseDto> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, organizationId: currentUser.organizationId },
      include: this.defaultInclude(),
    });

    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado');
    }

    // USER solo puede ver sus propios tickets
    if (
      currentUser.role === UserRole.USER &&
      ticket.createdById !== currentUser.id
    ) {
      throw new ForbiddenException('No tienes acceso a este ticket');
    }

    return this.mapToDto(ticket);
  }

  // ---------------------------------------------------------------------------
  // Actualizar ticket
  // ---------------------------------------------------------------------------

  async update(
    currentUser: RequestUser,
    id: string,
    dto: UpdateTicketDto,
  ): Promise<TicketResponseDto> {
    const existing = await this.findOne(currentUser, id);

    if (TERMINAL_STATUSES.includes(existing.status)) {
      throw new BadRequestException(
        'No se puede modificar un ticket en estado terminal',
      );
    }

    /**
     * Punto 2 — TECHNICIAN solo puede modificar tickets asignados a él.
     * Validado en el service, no solo en guards.
     */
    if (
      currentUser.role === UserRole.TECHNICIAN &&
      existing.assignedTo?.id !== currentUser.id
    ) {
      throw new ForbiddenException(
        'Solo puedes modificar tickets que estén asignados a ti',
      );
    }

    // Validar categoría si se cambia — solo ADMIN y TECHNICIAN llegan aquí
    if (dto.categoryId !== undefined && dto.categoryId !== null) {
      await this.validateCategory(currentUser.organizationId, dto.categoryId);
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (dto.title       !== undefined) changes['title']       = { from: existing.title,                  to: dto.title };
    if (dto.description !== undefined) changes['description'] = { from: existing.description,            to: dto.description };
    if (dto.priority    !== undefined) changes['priority']    = { from: existing.priority,               to: dto.priority };
    if (dto.categoryId  !== undefined) changes['categoryId']  = { from: existing.category?.id ?? null,  to: dto.categoryId };

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.ticket.updateMany({
        where: {
          id,
          organizationId: currentUser.organizationId,
          version: dto.version,
        },
        data: {
          ...(dto.title       !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.priority    !== undefined && { priority: dto.priority }),
          ...(dto.categoryId  !== undefined && { categoryId: dto.categoryId }),
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new ConflictException(
          'El ticket fue modificado por otro usuario. Recarga y vuelve a intentar.',
        );
      }

      await tx.ticketHistory.create({
        data: {
          ticketId: id,
          organizationId: currentUser.organizationId,
          changedById: currentUser.id,
          action: TicketHistoryAction.UPDATED,
          changes: changes as Prisma.InputJsonValue,
          occurredAt: new Date(),
        },
      });

      return tx.ticket.findUniqueOrThrow({
        where: { id },
        include: this.defaultInclude(),
      });
    });

    return this.mapToDto(updated);
  }

  // ---------------------------------------------------------------------------
  // Asignar / desasignar técnico
  // ---------------------------------------------------------------------------

  async assign(
    currentUser: RequestUser,
    id: string,
    dto: AssignTicketDto,
  ): Promise<TicketResponseDto> {
    const existing = await this.findOne(currentUser, id);

    if (TERMINAL_STATUSES.includes(existing.status)) {
      throw new BadRequestException(
        'No se puede reasignar un ticket en estado terminal',
      );
    }

    // Desasignar solo si el ticket está OPEN
    if (dto.assignedToId === null && existing.status !== TicketStatus.OPEN) {
      throw new BadRequestException(
        'Solo se puede desasignar un ticket en estado OPEN',
      );
    }

    if (dto.assignedToId !== null && dto.assignedToId !== undefined) {
      await this.validateAssignee(currentUser.organizationId, dto.assignedToId);
    }

    const action = dto.assignedToId
      ? TicketHistoryAction.ASSIGNED
      : TicketHistoryAction.UNASSIGNED;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.ticket.updateMany({
        where: {
          id,
          organizationId: currentUser.organizationId,
          version: dto.version,
        },
        data: {
          assignedToId: dto.assignedToId,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new ConflictException(
          'El ticket fue modificado por otro usuario. Recarga y vuelve a intentar.',
        );
      }

      await tx.ticketHistory.create({
        data: {
          ticketId: id,
          organizationId: currentUser.organizationId,
          changedById: currentUser.id,
          action,
          changes: {
            assignedToId: {
              from: existing.assignedTo?.id ?? null,
              to: dto.assignedToId,
            },
          } as Prisma.InputJsonValue,
          occurredAt: new Date(),
        },
      });

      return tx.ticket.findUniqueOrThrow({
        where: { id },
        include: this.defaultInclude(),
      });
    });

    this.eventEmitter.emit(EVENTS.TICKET_ASSIGNED, {
      ticketId: id,
      organizationId: currentUser.organizationId,
      assignedTo: dto.assignedToId,
      assignedBy: currentUser.id,
      previousAssignee: existing.assignedTo?.id ?? null,
      occurredAt: new Date(),
    });

    return this.mapToDto(updated);
  }

  // ---------------------------------------------------------------------------
  // Cambiar estado
  // ---------------------------------------------------------------------------

  async updateStatus(
    currentUser: RequestUser,
    id: string,
    dto: UpdateTicketStatusDto,
  ): Promise<TicketResponseDto> {
    const existing = await this.findOne(currentUser, id);

    // Validar transición permitida
    const allowed = ALLOWED_TRANSITIONS[existing.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Transición no permitida: ${existing.status} → ${dto.status}`,
      );
    }

    // Validar que tiene asignado si el estado lo requiere
    if (REQUIRES_ASSIGNEE.includes(dto.status) && !existing.assignedTo) {
      throw new BadRequestException(
        `El ticket debe tener un técnico asignado para pasar a ${dto.status}`,
      );
    }

    /**
     * Punto 2 — TECHNICIAN solo puede cambiar estado de tickets asignados a él.
     * Validado en el service.
     */
    if (
      currentUser.role === UserRole.TECHNICIAN &&
      existing.assignedTo?.id !== currentUser.id
    ) {
      throw new ForbiddenException(
        'Solo puedes cambiar el estado de tickets que estén asignados a ti',
      );
    }

    // TECHNICIAN no puede cancelar ni cerrar
    if (currentUser.role === UserRole.TECHNICIAN) {
      if (
        dto.status === TicketStatus.CANCELLED ||
        dto.status === TicketStatus.CLOSED
      ) {
        throw new ForbiddenException(
          'Los técnicos no pueden cancelar ni cerrar tickets',
        );
      }
    }

    const now = new Date();
    const timestampUpdate: Record<string, Date | null> = {};
    if (dto.status === TicketStatus.RESOLVED) timestampUpdate['resolvedAt'] = now;
    if (dto.status === TicketStatus.CLOSED)   timestampUpdate['closedAt']   = now;
    if (
      dto.status === TicketStatus.IN_PROGRESS &&
      existing.status === TicketStatus.RESOLVED
    ) {
      timestampUpdate['resolvedAt'] = null; // Reapertura
    }

    const action =
      dto.status === TicketStatus.CANCELLED ? TicketHistoryAction.CANCELLED :
      dto.status === TicketStatus.CLOSED    ? TicketHistoryAction.CLOSED    :
      TicketHistoryAction.STATUS_CHANGED;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.ticket.updateMany({
        where: {
          id,
          organizationId: currentUser.organizationId,
          version: dto.version,
        },
        data: {
          status: dto.status,
          ...timestampUpdate,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new ConflictException(
          'El ticket fue modificado por otro usuario. Recarga y vuelve a intentar.',
        );
      }

      await tx.ticketHistory.create({
        data: {
          ticketId: id,
          organizationId: currentUser.organizationId,
          changedById: currentUser.id,
          action,
          changes: {
            status: { from: existing.status, to: dto.status },
          } as Prisma.InputJsonValue,
          occurredAt: now,
        },
      });

      return tx.ticket.findUniqueOrThrow({
        where: { id },
        include: this.defaultInclude(),
      });
    });

    this.eventEmitter.emit(EVENTS.TICKET_STATUS_CHANGED, {
      ticketId: id,
      organizationId: currentUser.organizationId,
      from: existing.status,
      to: dto.status,
      changedBy: currentUser.id,
      occurredAt: now,
    });

    if (dto.status === TicketStatus.CLOSED) {
      this.eventEmitter.emit(EVENTS.TICKET_CLOSED, {
        ticketId: id,
        organizationId: currentUser.organizationId,
        resolvedBy: currentUser.id,
        durationMs: now.getTime() - new Date(existing.createdAt).getTime(),
        occurredAt: now,
      });
    }

    return this.mapToDto(updated);
  }

  // ---------------------------------------------------------------------------
  // Helpers privados
  // ---------------------------------------------------------------------------

  private async validateCategory(
    organizationId: string,
    categoryId: string,
  ): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, organizationId, isActive: true, deletedAt: null },
    });
    if (!category) {
      throw new BadRequestException(
        'La categoría no existe, no pertenece a esta organización o está inactiva',
      );
    }
  }

  private async validateAssignee(
    organizationId: string,
    assignedToId: string,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: assignedToId,
        organizationId,
        deletedAt: null,
        status: UserStatus.ACTIVE,
        role: { in: [UserRole.TECHNICIAN, UserRole.ADMIN] },
      },
    });
    if (!user) {
      throw new BadRequestException(
        'El técnico asignado no existe, no pertenece a esta organización, no está activo o no tiene el rol requerido',
      );
    }
  }

  private formatNumber(number: number): string {
    return `TKT-${number.toString().padStart(4, '0')}`;
  }

  private defaultInclude() {
    return {
      createdBy: {
        select: { id: true, fullName: true, avatarUrl: true },
      },
      assignedTo: {
        select: { id: true, fullName: true, avatarUrl: true },
      },
      category: {
        select: { id: true, name: true, slug: true },
      },
    } as const;
  }

  private mapToDto(ticket: {
    id: string;
    number: number;
    title: string;
    description: string;
    status: TicketStatus;
    priority: TicketPriority;
    version: number;
    createdBy: TicketUserDto;
    assignedTo: TicketUserDto | null;
    category: TicketCategoryDto | null;
    firstResponseAt: Date | null;
    resolvedAt: Date | null;
    closedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): TicketResponseDto {
    return {
      id: ticket.id,
      ticketNumber: this.formatNumber(ticket.number),
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      version: ticket.version,
      createdBy: ticket.createdBy,
      assignedTo: ticket.assignedTo,
      category: ticket.category,
      firstResponseAt: ticket.firstResponseAt,
      resolvedAt: ticket.resolvedAt,
      closedAt: ticket.closedAt,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };
  }
}