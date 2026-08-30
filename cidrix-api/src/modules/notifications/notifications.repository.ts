import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';

const NOTIFICATION_RESPONSE_SELECT = {
  id: true,
  type: true,
  title: true,
  message: true,
  ticketId: true,
  readAt: true,
  createdAt: true,
  ticket: { select: { number: true } },
} as const;

export type NotificationRecord = Prisma.NotificationGetPayload<{
  select: typeof NOTIFICATION_RESPONSE_SELECT;
}>;

export interface NotificationTicketContext {
  id: string;
  number: number;
  createdById: string;
  assignedToId: string | null;
}

export interface NotificationUserContext {
  id: string;
  role: UserRole;
  status: UserStatus;
  deletedAt: Date | null;
}

export interface CreateNotificationData {
  organizationId: string;
  userId: string;
  ticketId: string;
  type: NotificationType;
  title: string;
  message: string;
}

export interface FindNotificationsOptions {
  organizationId: string;
  userId: string;
  page: number;
  limit: number;
  isRead?: boolean;
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(options: FindNotificationsOptions): Promise<{
    items: NotificationRecord[];
    total: number;
  }> {
    const { organizationId, userId, page, limit, isRead } = options;
    const where: Prisma.NotificationWhereInput = {
      organizationId,
      userId,
      ...(isRead === undefined
        ? {}
        : { readAt: isRead ? { not: null } : null }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        select: NOTIFICATION_RESPONSE_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, total };
  }

  countUnread(organizationId: string, userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { organizationId, userId, readAt: null },
    });
  }

  findOwn(
    organizationId: string,
    userId: string,
    id: string,
  ): Promise<NotificationRecord | null> {
    return this.prisma.notification.findFirst({
      where: { id, organizationId, userId },
      select: NOTIFICATION_RESPONSE_SELECT,
    });
  }

  async markRead(
    organizationId: string,
    userId: string,
    id: string,
    readAt: Date,
  ): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { id, organizationId, userId, readAt: null },
      data: { readAt },
    });
    return result.count;
  }

  async markAllRead(
    organizationId: string,
    userId: string,
    readAt: Date,
  ): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { organizationId, userId, readAt: null },
      data: { readAt },
    });
    return result.count;
  }

  async create(data: CreateNotificationData): Promise<void> {
    await this.prisma.notification.create({
      data,
      select: { id: true },
    });
  }

  findTicketContext(
    organizationId: string,
    ticketId: string,
  ): Promise<NotificationTicketContext | null> {
    return this.prisma.ticket.findFirst({
      where: { organizationId, id: ticketId },
      select: {
        id: true,
        number: true,
        createdById: true,
        assignedToId: true,
      },
    });
  }

  findUserContext(
    organizationId: string,
    userId: string,
  ): Promise<NotificationUserContext | null> {
    return this.prisma.user.findFirst({
      where: { organizationId, id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        deletedAt: true,
      },
    });
  }
}
