import { Injectable } from '@nestjs/common';
import { CommentVisibility, Prisma, TicketStatus } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { SortOrder } from '@modules/tickets/dto/ticket-filters.dto';

export interface LockedAttachmentTicketRow {
  id: string;
  organizationId: string;
  status: TicketStatus;
  createdById: string;
  assignedToId: string | null;
}

export interface AttachmentUsage {
  count: number;
  totalSizeBytes: number;
}

export interface CreateAttachmentData {
  organizationId: string;
  ticketId: string;
  commentId: string | null;
  uploadedById: string;
  originalName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  visibility: CommentVisibility;
}

export interface FindAttachmentsOptions {
  organizationId: string;
  ticketId: string;
  commentId?: string;
  allowedVisibilities: CommentVisibility[];
  page: number;
  limit: number;
  order: SortOrder;
}

const ATTACHMENT_RESPONSE_SELECT = {
  id: true,
  ticketId: true,
  commentId: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  visibility: true,
  createdAt: true,
  uploadedBy: {
    select: { id: true, fullName: true, role: true },
  },
} as const;

@Injectable()
export class AttachmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  runTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async lockTicketForUpdate(
    tx: Prisma.TransactionClient,
    organizationId: string,
    ticketId: string,
  ): Promise<LockedAttachmentTicketRow | null> {
    const rows = await tx.$queryRaw<LockedAttachmentTicketRow[]>`
      SELECT
        "id"              AS "id",
        "organization_id" AS "organizationId",
        "status"::text    AS "status",
        "created_by_id"   AS "createdById",
        "assigned_to_id"  AS "assignedToId"
      FROM "tickets"
      WHERE "organization_id" = ${organizationId}
        AND "id" = ${ticketId}
      FOR UPDATE
    `;

    return rows[0] ?? null;
  }

  findCommentForAttachment(
    tx: Prisma.TransactionClient,
    organizationId: string,
    ticketId: string,
    commentId: string,
  ) {
    return tx.comment.findFirst({
      where: { id: commentId, organizationId, ticketId },
      select: { id: true, authorId: true, visibility: true },
    });
  }

  findCommentForTicket(
    organizationId: string,
    ticketId: string,
    commentId: string,
  ) {
    return this.prisma.comment.findFirst({
      where: { id: commentId, organizationId, ticketId },
      select: { id: true, authorId: true, visibility: true },
    });
  }

  async getActiveUsage(
    tx: Prisma.TransactionClient,
    organizationId: string,
    ticketId: string,
  ): Promise<AttachmentUsage> {
    const [count, aggregate] = await Promise.all([
      tx.attachment.count({
        where: { organizationId, ticketId, deletedAt: null },
      }),
      tx.attachment.aggregate({
        where: { organizationId, ticketId, deletedAt: null },
        _sum: { sizeBytes: true },
      }),
    ]);

    return {
      count,
      totalSizeBytes: aggregate._sum.sizeBytes ?? 0,
    };
  }

  createAttachment(tx: Prisma.TransactionClient, data: CreateAttachmentData) {
    return tx.attachment.create({
      data,
      select: ATTACHMENT_RESPONSE_SELECT,
    });
  }

  async findManyForTicket(options: FindAttachmentsOptions) {
    const {
      organizationId,
      ticketId,
      commentId,
      allowedVisibilities,
      page,
      limit,
      order,
    } = options;
    const where: Prisma.AttachmentWhereInput = {
      organizationId,
      ticketId,
      deletedAt: null,
      visibility: { in: allowedVisibilities },
      ...(commentId && { commentId }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.attachment.findMany({
        where,
        select: ATTACHMENT_RESPONSE_SELECT,
        orderBy: [{ createdAt: order }, { id: order }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.attachment.count({ where }),
    ]);

    return { items, total };
  }

  findForDownload(params: {
    organizationId: string;
    ticketId: string;
    attachmentId: string;
    allowedVisibilities: CommentVisibility[];
  }) {
    return this.prisma.attachment.findFirst({
      where: {
        id: params.attachmentId,
        organizationId: params.organizationId,
        ticketId: params.ticketId,
        deletedAt: null,
        visibility: { in: params.allowedVisibilities },
      },
      select: {
        storageKey: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
      },
    });
  }

  async softDelete(params: {
    organizationId: string;
    ticketId: string;
    attachmentId: string;
    deletedById: string;
  }): Promise<{ storageKey: string } | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.attachment.findFirst({
        where: {
          id: params.attachmentId,
          organizationId: params.organizationId,
          ticketId: params.ticketId,
          deletedAt: null,
        },
        select: { storageKey: true },
      });

      if (!existing) {
        return null;
      }

      const result = await tx.attachment.updateMany({
        where: {
          id: params.attachmentId,
          organizationId: params.organizationId,
          ticketId: params.ticketId,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
          deletedById: params.deletedById,
        },
      });

      return result.count === 1 ? existing : null;
    });
  }
}
