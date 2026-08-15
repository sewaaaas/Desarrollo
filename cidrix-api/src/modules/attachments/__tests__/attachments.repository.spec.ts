/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-assignment */
import 'reflect-metadata';
import { CommentVisibility, Prisma } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { SortOrder } from '@modules/tickets/dto/ticket-filters.dto';
import { AttachmentsRepository } from '../attachments.repository';

describe('AttachmentsRepository', () => {
  let repository: AttachmentsRepository;
  let prisma: {
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
    attachment: {
      findMany: jest.Mock;
      count: jest.Mock;
      aggregate: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      updateMany: jest.Mock;
    };
    comment: { findFirst: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      $queryRaw: jest.fn(),
      attachment: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { sizeBytes: null } }),
        create: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
      comment: { findFirst: jest.fn() },
    };
    prisma.$transaction.mockImplementation(
      (
        input:
          | Prisma.PrismaPromise<unknown>[]
          | ((tx: typeof prisma) => Promise<unknown>),
      ) =>
        Array.isArray(input)
          ? Promise.all(input)
          : (input as (tx: typeof prisma) => Promise<unknown>)(prisma),
    );
    repository = new AttachmentsRepository(prisma as unknown as PrismaService);
  });

  it('lista con organizationId + ticketId, excluye soft-deleted y ordena createdAt + id', async () => {
    await repository.findManyForTicket({
      organizationId: 'org-a',
      ticketId: 'ticket-1',
      commentId: 'comment-1',
      allowedVisibilities: [CommentVisibility.PUBLIC],
      page: 2,
      limit: 10,
      order: SortOrder.ASC,
    });

    expect(prisma.attachment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-a',
          ticketId: 'ticket-1',
          commentId: 'comment-1',
          deletedAt: null,
          visibility: { in: [CommentVisibility.PUBLIC] },
        },
        orderBy: [{ createdAt: SortOrder.ASC }, { id: SortOrder.ASC }],
        skip: 10,
        take: 10,
      }),
    );
    expect(prisma.attachment.count).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-a',
        ticketId: 'ticket-1',
        commentId: 'comment-1',
        deletedAt: null,
        visibility: { in: [CommentVisibility.PUBLIC] },
      },
    });
  });

  it('download filtra tenant, ticket, attachment, deletedAt y visibilidad', async () => {
    await repository.findForDownload({
      organizationId: 'org-a',
      ticketId: 'ticket-1',
      attachmentId: 'attachment-1',
      allowedVisibilities: [CommentVisibility.PUBLIC],
    });

    expect(prisma.attachment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'attachment-1',
          organizationId: 'org-a',
          ticketId: 'ticket-1',
          deletedAt: null,
          visibility: { in: [CommentVisibility.PUBLIC] },
        },
      }),
    );
  });

  it('consulta comment con organizationId + ticketId + commentId', async () => {
    await repository.findCommentForTicket('org-a', 'ticket-1', 'comment-1');

    expect(prisma.comment.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'comment-1',
        organizationId: 'org-a',
        ticketId: 'ticket-1',
      },
      select: { id: true, authorId: true, visibility: true },
    });
  });

  it('calcula count y sum únicamente sobre attachments activos del tenant/ticket', async () => {
    prisma.attachment.count.mockResolvedValue(3);
    prisma.attachment.aggregate.mockResolvedValue({
      _sum: { sizeBytes: 1234 },
    });

    await expect(
      repository.getActiveUsage(
        prisma as unknown as Prisma.TransactionClient,
        'org-a',
        'ticket-1',
      ),
    ).resolves.toEqual({ count: 3, totalSizeBytes: 1234 });
    expect(prisma.attachment.count).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-a',
        ticketId: 'ticket-1',
        deletedAt: null,
      },
    });
  });

  it('soft-delete actualiza metadata con filtros tenant-first', async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      storageKey: 'attachments/key',
    });
    prisma.attachment.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      repository.softDelete({
        organizationId: 'org-a',
        ticketId: 'ticket-1',
        attachmentId: 'attachment-1',
        deletedById: 'admin-1',
      }),
    ).resolves.toEqual({ storageKey: 'attachments/key' });
    expect(prisma.attachment.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'attachment-1',
        organizationId: 'org-a',
        ticketId: 'ticket-1',
        deletedAt: null,
      },
      data: {
        deletedAt: expect.any(Date),
        deletedById: 'admin-1',
      },
    });
  });

  it('soft-delete retorna null sin update si no existe metadata activa', async () => {
    prisma.attachment.findFirst.mockResolvedValue(null);

    await expect(
      repository.softDelete({
        organizationId: 'org-a',
        ticketId: 'ticket-1',
        attachmentId: 'attachment-x',
        deletedById: 'admin-1',
      }),
    ).resolves.toBeNull();
    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
  });
});
