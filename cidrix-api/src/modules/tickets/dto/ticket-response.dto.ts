import { TicketPriority, TicketStatus } from '@prisma/client';

export class TicketUserDto {
  id!: string;
  fullName!: string;
  avatarUrl!: string | null;
}

export class TicketCategoryDto {
  id!: string;
  name!: string;
  slug!: string;
}

export class TicketResponseDto {
  id!: string;
  /// Número formateado: TKT-0001
  ticketNumber!: string;
  title!: string;
  description!: string;
  status!: TicketStatus;
  priority!: TicketPriority;
  version!: number;
  createdBy!: TicketUserDto;
  assignedTo!: TicketUserDto | null;
  category!: TicketCategoryDto | null;
  firstResponseAt!: Date | null;
  resolvedAt!: Date | null;
  closedAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class PaginatedTicketsDto {
  data!: TicketResponseDto[];
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}