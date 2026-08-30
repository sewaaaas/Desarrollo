import { NotificationType } from '@prisma/client';

export class NotificationResponseDto {
  id!: string;
  type!: NotificationType;
  title!: string;
  message!: string;
  ticketId!: string;
  ticketNumber!: string;
  isRead!: boolean;
  readAt!: Date | null;
  createdAt!: Date;
}

export class PaginatedNotificationsDto {
  data!: NotificationResponseDto[];
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class UnreadCountResponseDto {
  count!: number;
}

export class ReadAllResponseDto {
  updatedCount!: number;
}
