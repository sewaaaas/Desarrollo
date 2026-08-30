import { Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationType,
  TicketStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import {
  CommentAddedEvent,
  TicketAssignedEvent,
  TicketCreatedEvent,
  TicketStatusChangedEvent,
} from '@integrations/events/event-types';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';
import { NotificationFiltersDto } from './dto/notification-filters.dto';
import {
  NotificationResponseDto,
  PaginatedNotificationsDto,
  ReadAllResponseDto,
  UnreadCountResponseDto,
} from './dto/notification-response.dto';
import {
  NotificationRecord,
  NotificationsRepository,
  NotificationTicketContext,
  NotificationUserContext,
} from './notifications.repository';

const NOTIFIABLE_STATUSES = new Set<string>([
  TicketStatus.IN_PROGRESS,
  TicketStatus.PENDING,
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
  TicketStatus.CANCELLED,
]);

@Injectable()
export class NotificationsService {
  constructor(private readonly repository: NotificationsRepository) {}

  async list(
    currentUser: RequestUser,
    filters: NotificationFiltersDto,
  ): Promise<PaginatedNotificationsDto> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const { items, total } = await this.repository.findMany({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      page,
      limit,
      isRead: filters.isRead,
    });

    return {
      data: items.map((item) => this.toResponse(item)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUnreadCount(
    currentUser: RequestUser,
  ): Promise<UnreadCountResponseDto> {
    return {
      count: await this.repository.countUnread(
        currentUser.organizationId,
        currentUser.id,
      ),
    };
  }

  async markRead(
    currentUser: RequestUser,
    notificationId: string,
  ): Promise<NotificationResponseDto> {
    const existing = await this.repository.findOwn(
      currentUser.organizationId,
      currentUser.id,
      notificationId,
    );

    if (!existing) {
      throw new NotFoundException('Notificación no encontrada');
    }

    if (existing.readAt !== null) {
      return this.toResponse(existing);
    }

    await this.repository.markRead(
      currentUser.organizationId,
      currentUser.id,
      notificationId,
      new Date(),
    );

    const updated = await this.repository.findOwn(
      currentUser.organizationId,
      currentUser.id,
      notificationId,
    );

    if (!updated) {
      throw new NotFoundException('Notificación no encontrada');
    }

    return this.toResponse(updated);
  }

  async markAllRead(currentUser: RequestUser): Promise<ReadAllResponseDto> {
    return {
      updatedCount: await this.repository.markAllRead(
        currentUser.organizationId,
        currentUser.id,
        new Date(),
      ),
    };
  }

  async handleTicketCreated(event: TicketCreatedEvent): Promise<void> {
    if (!event.assignedTo || event.createdBy === event.assignedTo) return;

    const ticket = await this.repository.findTicketContext(
      event.organizationId,
      event.ticketId,
    );
    if (!ticket) return;

    await this.createForRecipient({
      organizationId: event.organizationId,
      ticket,
      actorId: event.createdBy,
      recipientId: event.assignedTo,
      type: NotificationType.TICKET_ASSIGNED,
      title: 'Ticket asignado',
      message: `Se te asignó el ticket ${this.formatTicketNumber(ticket.number)}`,
    });
  }

  async handleTicketAssigned(event: TicketAssignedEvent): Promise<void> {
    if (
      !event.assignedTo ||
      event.assignedTo === event.previousAssignee ||
      event.assignedBy === event.assignedTo
    ) {
      return;
    }

    const ticket = await this.repository.findTicketContext(
      event.organizationId,
      event.ticketId,
    );
    if (!ticket) return;

    await this.createForRecipient({
      organizationId: event.organizationId,
      ticket,
      actorId: event.assignedBy,
      recipientId: event.assignedTo,
      type: NotificationType.TICKET_ASSIGNED,
      title: 'Ticket asignado',
      message: `Se te asignó el ticket ${this.formatTicketNumber(ticket.number)}`,
    });
  }

  async handleCommentAdded(event: CommentAddedEvent): Promise<void> {
    const [ticket, actor] = await Promise.all([
      this.repository.findTicketContext(event.organizationId, event.ticketId),
      this.repository.findUserContext(event.organizationId, event.authorId),
    ]);
    if (!ticket || !actor) return;

    if (event.isInternal) {
      await this.createInternalCommentNotification(event, ticket);
      return;
    }

    const recipientId =
      actor.role === UserRole.USER
        ? ticket.assignedToId
        : actor.role === UserRole.ADMIN || actor.role === UserRole.TECHNICIAN
          ? ticket.createdById
          : null;
    if (!recipientId) return;

    await this.createForRecipient({
      organizationId: event.organizationId,
      ticket,
      actorId: event.authorId,
      recipientId,
      type: NotificationType.COMMENT_ADDED,
      title: 'Nuevo comentario en ticket',
      message: `Hay un nuevo comentario en ${this.formatTicketNumber(ticket.number)}`,
    });
  }

  async handleTicketStatusChanged(
    event: TicketStatusChangedEvent,
  ): Promise<void> {
    if (event.from === event.to || !NOTIFIABLE_STATUSES.has(event.to)) return;

    const ticket = await this.repository.findTicketContext(
      event.organizationId,
      event.ticketId,
    );
    if (!ticket) return;

    const ticketNumber = this.formatTicketNumber(ticket.number);
    await this.createForRecipient({
      organizationId: event.organizationId,
      ticket,
      actorId: event.changedBy,
      recipientId: ticket.createdById,
      type: NotificationType.TICKET_STATUS_CHANGED,
      title: 'Estado de ticket actualizado',
      message: `El ticket ${ticketNumber} cambió de ${event.from} a ${event.to}`,
    });
  }

  private async createInternalCommentNotification(
    event: CommentAddedEvent,
    ticket: NotificationTicketContext,
  ): Promise<void> {
    if (!ticket.assignedToId || ticket.assignedToId === event.authorId) return;

    const recipient = await this.getValidRecipient(
      event.organizationId,
      ticket.assignedToId,
    );
    if (
      !recipient ||
      (recipient.role !== UserRole.ADMIN &&
        recipient.role !== UserRole.TECHNICIAN)
    ) {
      return;
    }

    await this.repository.create({
      organizationId: event.organizationId,
      userId: recipient.id,
      ticketId: ticket.id,
      type: NotificationType.COMMENT_ADDED,
      title: 'Nueva nota interna en ticket',
      message: `Nueva nota interna en ${this.formatTicketNumber(ticket.number)}`,
    });
  }

  private async createForRecipient(params: {
    organizationId: string;
    ticket: NotificationTicketContext;
    actorId: string;
    recipientId: string;
    type: NotificationType;
    title: string;
    message: string;
  }): Promise<void> {
    if (params.actorId === params.recipientId) return;

    const recipient = await this.getValidRecipient(
      params.organizationId,
      params.recipientId,
    );
    if (!recipient) return;

    await this.repository.create({
      organizationId: params.organizationId,
      userId: recipient.id,
      ticketId: params.ticket.id,
      type: params.type,
      title: params.title,
      message: params.message,
    });
  }

  private async getValidRecipient(
    organizationId: string,
    recipientId: string,
  ): Promise<NotificationUserContext | null> {
    const recipient = await this.repository.findUserContext(
      organizationId,
      recipientId,
    );

    return recipient?.status === UserStatus.ACTIVE &&
      recipient.deletedAt === null
      ? recipient
      : null;
  }

  private toResponse(record: NotificationRecord): NotificationResponseDto {
    return {
      id: record.id,
      type: record.type,
      title: record.title,
      message: record.message,
      ticketId: record.ticketId,
      ticketNumber: this.formatTicketNumber(record.ticket.number),
      isRead: record.readAt !== null,
      readAt: record.readAt,
      createdAt: record.createdAt,
    };
  }

  private formatTicketNumber(number: number): string {
    return `TKT-${number.toString().padStart(4, '0')}`;
  }
}
