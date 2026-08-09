import { Injectable } from '@nestjs/common';
import { CommentVisibility, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';
import { SortOrder } from './dto/ticket-filters.dto';
import { TicketTimelineFiltersDto } from './dto/ticket-timeline-filters.dto';
import {
  PaginatedTicketTimelineDto,
  TicketTimelineActorDto,
  TicketTimelineCommentItemDto,
  TicketTimelineHistoryItemDto,
  TicketTimelineItemDto,
  TicketTimelineItemType,
} from './dto/ticket-timeline-response.dto';
import { TicketsService } from './tickets.service';

const PUBLIC_HISTORY_FIELDS = new Set([
  'title',
  'description',
  'priority',
  'status',
  'firstResponseAt',
]);

const COMMENT_SELECT = {
  id: true,
  content: true,
  visibility: true,
  createdAt: true,
  author: {
    select: { id: true, fullName: true, role: true },
  },
} as const;

const HISTORY_SELECT = {
  id: true,
  changedById: true,
  action: true,
  changes: true,
  occurredAt: true,
} as const;

type TimelineCommentRecord = Prisma.CommentGetPayload<{
  select: typeof COMMENT_SELECT;
}>;

type TimelineHistoryRecord = Prisma.TicketHistoryGetPayload<{
  select: typeof HISTORY_SELECT;
}>;

@Injectable()
export class TicketTimelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketsService: TicketsService,
  ) {}

  async findAll(
    currentUser: RequestUser,
    ticketId: string,
    filters: TicketTimelineFiltersDto,
  ): Promise<PaginatedTicketTimelineDto> {
    // Fuente unica de verdad para el alcance de lectura: 404 fuera del tenant,
    // 403 para USER sobre un ticket ajeno y lectura de toda la organizacion
    // para TECHNICIAN/ADMIN.
    await this.ticketsService.findOne(currentUser, ticketId);

    const organizationId = currentUser.organizationId;
    const allowedVisibilities =
      currentUser.role === UserRole.USER
        ? [CommentVisibility.PUBLIC]
        : [CommentVisibility.PUBLIC, CommentVisibility.INTERNAL];

    const { comments, history, historyActors } = await this.prisma.$transaction(
      async (tx) => {
        const [commentRows, historyRows] = await Promise.all([
          tx.comment.findMany({
            where: {
              organizationId,
              ticketId,
              visibility: { in: allowedVisibilities },
            },
            select: COMMENT_SELECT,
          }),
          tx.ticketHistory.findMany({
            where: { organizationId, ticketId },
            select: HISTORY_SELECT,
          }),
        ]);

        const actorIds = [
          ...new Set(
            historyRows
              .map((item) => item.changedById)
              .filter((id): id is string => id !== null),
          ),
        ];

        // TicketHistory.changedBy no usa una FK tenant-first. La resolucion
        // explicita del actor vuelve a aplicar organizationId y evita confiar
        // unicamente en esa relacion.
        const actors = actorIds.length
          ? await tx.user.findMany({
              where: { organizationId, id: { in: actorIds } },
              select: { id: true, fullName: true, role: true },
            })
          : [];

        return {
          comments: commentRows,
          history: historyRows,
          historyActors: actors,
        };
      },
    );

    const actorById = new Map(
      historyActors.map((actor) => [
        actor.id,
        { id: actor.id, name: actor.fullName, role: actor.role },
      ]),
    );

    const items: TicketTimelineItemDto[] = [
      ...comments.map((comment) => this.mapComment(comment)),
      ...history.map((item) =>
        this.mapHistory(item, actorById, currentUser.role),
      ),
    ];

    const order = filters.order ?? SortOrder.ASC;
    items.sort((left, right) => this.compareItems(left, right, order));

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const total = items.length;
    const start = (page - 1) * limit;

    return {
      data: items.slice(start, start + limit),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  private mapComment(
    comment: TimelineCommentRecord,
  ): TicketTimelineCommentItemDto {
    return {
      id: comment.id,
      type: TicketTimelineItemType.COMMENT,
      timestamp: comment.createdAt,
      actor: {
        id: comment.author.id,
        name: comment.author.fullName,
        role: comment.author.role,
      },
      content: comment.content,
      visibility: comment.visibility,
    };
  }

  private mapHistory(
    item: TimelineHistoryRecord,
    actorById: Map<string, TicketTimelineActorDto>,
    role: UserRole,
  ): TicketTimelineHistoryItemDto {
    return {
      id: item.id,
      type: TicketTimelineItemType.HISTORY,
      timestamp: item.occurredAt,
      actor: item.changedById
        ? (actorById.get(item.changedById) ?? null)
        : null,
      action: item.action,
      changes: this.resolveHistoryChanges(item.changes, role),
    };
  }

  private resolveHistoryChanges(
    changes: Prisma.JsonValue | null,
    role: UserRole,
  ): Prisma.JsonValue | null {
    if (role !== UserRole.USER) {
      return changes;
    }

    // Fail-closed: solo los campos expresamente permitidos se copian. Arrays,
    // escalares y cualquier forma futura inesperada se ocultan por completo.
    if (
      changes === null ||
      typeof changes !== 'object' ||
      Array.isArray(changes)
    ) {
      return null;
    }

    const publicChanges: Record<string, Prisma.JsonValue> = {};

    for (const [field, value] of Object.entries(changes)) {
      if (PUBLIC_HISTORY_FIELDS.has(field) && value !== undefined) {
        publicChanges[field] = value;
      }
    }

    return Object.keys(publicChanges).length > 0 ? publicChanges : null;
  }

  private compareItems(
    left: TicketTimelineItemDto,
    right: TicketTimelineItemDto,
    order: SortOrder,
  ): number {
    const direction = order === SortOrder.ASC ? 1 : -1;
    const timestampDifference =
      left.timestamp.getTime() - right.timestamp.getTime();

    if (timestampDifference !== 0) {
      return timestampDifference * direction;
    }

    // COMMENT siempre precede a HISTORY cuando comparten timestamp, incluso
    // en orden descendente. Asi el mensaje aparece antes de FIRST_RESPONSE.
    const leftTypeRank = left.type === TicketTimelineItemType.COMMENT ? 0 : 1;
    const rightTypeRank = right.type === TicketTimelineItemType.COMMENT ? 0 : 1;

    if (leftTypeRank !== rightTypeRank) {
      return leftTypeRank - rightTypeRank;
    }

    return left.id.localeCompare(right.id) * direction;
  }
}
