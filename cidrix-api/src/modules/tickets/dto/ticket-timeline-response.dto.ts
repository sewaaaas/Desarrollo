import {
  CommentVisibility,
  Prisma,
  TicketHistoryAction,
  UserRole,
} from '@prisma/client';

export enum TicketTimelineItemType {
  COMMENT = 'COMMENT',
  HISTORY = 'HISTORY',
}

export class TicketTimelineActorDto {
  id!: string;
  name!: string;
  role!: UserRole;
}

export class TicketTimelineCommentItemDto {
  id!: string;
  type!: TicketTimelineItemType.COMMENT;
  timestamp!: Date;
  actor!: TicketTimelineActorDto;
  content!: string;
  visibility!: CommentVisibility;
}

export class TicketTimelineHistoryItemDto {
  id!: string;
  type!: TicketTimelineItemType.HISTORY;
  timestamp!: Date;
  actor!: TicketTimelineActorDto | null;
  action!: TicketHistoryAction;
  changes!: Prisma.JsonValue | null;
}

export type TicketTimelineItemDto =
  TicketTimelineCommentItemDto | TicketTimelineHistoryItemDto;

export class PaginatedTicketTimelineDto {
  data!: TicketTimelineItemDto[];
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
