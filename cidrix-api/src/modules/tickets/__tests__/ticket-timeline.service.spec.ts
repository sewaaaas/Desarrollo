import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  CommentVisibility,
  TicketHistoryAction,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';
import { SortOrder } from '../dto/ticket-filters.dto';
import { TicketTimelineItemType } from '../dto/ticket-timeline-response.dto';
import { TicketTimelineService } from '../ticket-timeline.service';
import { TicketsService } from '../tickets.service';

describe('TicketTimelineService', () => {
  const ORG_A = 'org-a';
  const ORG_B = 'org-b';
  const TICKET_ID = 'ticket-1';

  let service: TicketTimelineService;
  let prisma: {
    $transaction: jest.Mock;
    comment: { findMany: jest.Mock };
    ticketHistory: { findMany: jest.Mock };
    user: { findMany: jest.Mock };
  };
  let ticketsService: { findOne: jest.Mock };

  const publicComment = {
    id: 'comment-public',
    content: 'Respuesta pública',
    visibility: CommentVisibility.PUBLIC,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    author: {
      id: 'tech-1',
      fullName: 'Técnica Uno',
      role: UserRole.TECHNICIAN,
    },
  };

  const internalComment = {
    id: 'comment-internal',
    content: 'Nota interna',
    visibility: CommentVisibility.INTERNAL,
    createdAt: new Date('2026-08-01T10:01:00.000Z'),
    author: {
      id: 'admin-1',
      fullName: 'Admin Uno',
      role: UserRole.ADMIN,
    },
  };

  const updatedHistory = {
    id: 'history-updated',
    changedById: 'admin-1',
    action: TicketHistoryAction.UPDATED,
    changes: {
      title: { from: 'Antes', to: 'Después' },
      description: { from: 'Vieja', to: 'Nueva' },
      priority: { from: 'LOW', to: 'HIGH' },
      status: { from: 'OPEN', to: 'IN_PROGRESS' },
      firstResponseAt: { from: null, to: '2026-08-01T10:00:00.000Z' },
      triggerCommentId: { from: null, to: 'comment-public' },
      assignedToId: { from: null, to: 'tech-1' },
      categoryId: { from: null, to: 'category-1' },
      futureSensitiveField: { from: null, to: 'secret' },
    },
    occurredAt: new Date('2026-08-01T10:02:00.000Z'),
  };

  function makeUser(overrides: Partial<RequestUser> = {}): RequestUser {
    return {
      id: 'user-owner',
      email: 'owner@cidrix.test',
      role: UserRole.USER,
      organizationId: ORG_A,
      ...overrides,
    };
  }

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      comment: { findMany: jest.fn().mockResolvedValue([]) },
      ticketHistory: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    prisma.$transaction.mockImplementation(
      (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    );

    ticketsService = {
      findOne: jest.fn().mockResolvedValue({ id: TICKET_ID }),
    };

    service = new TicketTimelineService(
      prisma as unknown as PrismaService,
      ticketsService as unknown as TicketsService,
    );
  });

  it('ADMIN obtiene comentarios PUBLIC, INTERNAL y TicketHistory con changes completo', async () => {
    prisma.comment.findMany.mockResolvedValue([publicComment, internalComment]);
    prisma.ticketHistory.findMany.mockResolvedValue([updatedHistory]);
    prisma.user.findMany.mockResolvedValue([
      { id: 'admin-1', fullName: 'Admin Uno', role: UserRole.ADMIN },
    ]);

    const result = await service.findAll(
      makeUser({ role: UserRole.ADMIN, id: 'admin-1' }),
      TICKET_ID,
      {},
    );

    expect(result.data).toHaveLength(3);
    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          visibility: {
            in: [CommentVisibility.PUBLIC, CommentVisibility.INTERNAL],
          },
        }),
      }),
    );
    const history = result.data.find(
      (item) => item.type === TicketTimelineItemType.HISTORY,
    );
    expect(history).toEqual(
      expect.objectContaining({ changes: updatedHistory.changes }),
    );
  });

  it('TECHNICIAN conserva el alcance de lectura de TicketsService y recibe changes completo', async () => {
    prisma.ticketHistory.findMany.mockResolvedValue([updatedHistory]);

    const technician = makeUser({
      id: 'tech-not-assigned',
      role: UserRole.TECHNICIAN,
    });
    const result = await service.findAll(technician, TICKET_ID, {});

    expect(ticketsService.findOne).toHaveBeenCalledWith(technician, TICKET_ID);
    expect(result.data[0]).toEqual(
      expect.objectContaining({ changes: updatedHistory.changes }),
    );
  });

  it('USER solo consulta comentarios PUBLIC y nunca INTERNAL', async () => {
    prisma.comment.findMany.mockResolvedValue([publicComment]);

    const result = await service.findAll(makeUser(), TICKET_ID, {});

    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          visibility: { in: [CommentVisibility.PUBLIC] },
        }),
      }),
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual(
      expect.objectContaining({ visibility: CommentVisibility.PUBLIC }),
    );
  });

  it('USER recibe únicamente la allowlist pública de TicketHistory.changes', async () => {
    prisma.ticketHistory.findMany.mockResolvedValue([updatedHistory]);

    const result = await service.findAll(makeUser(), TICKET_ID, {});
    const history = result.data[0];

    expect(history).toEqual(
      expect.objectContaining({
        changes: {
          title: updatedHistory.changes.title,
          description: updatedHistory.changes.description,
          priority: updatedHistory.changes.priority,
          status: updatedHistory.changes.status,
          firstResponseAt: updatedHistory.changes.firstResponseAt,
        },
      }),
    );
    expect(history).not.toHaveProperty('changes.triggerCommentId');
    expect(history).not.toHaveProperty('changes.assignedToId');
    expect(history).not.toHaveProperty('changes.categoryId');
    expect(history).not.toHaveProperty('changes.futureSensitiveField');
  });

  it('la sanitización de USER es fail-closed para objetos sin campos permitidos y formas inesperadas', async () => {
    prisma.ticketHistory.findMany.mockResolvedValue([
      {
        ...updatedHistory,
        id: 'history-only-private',
        changes: { triggerCommentId: { from: null, to: 'comment-1' } },
      },
      {
        ...updatedHistory,
        id: 'history-array',
        changes: ['unexpected'],
      },
    ]);

    const result = await service.findAll(makeUser(), TICKET_ID, {});

    expect(result.data).toHaveLength(2);
    expect(
      result.data.every(
        (item) =>
          item.type === TicketTimelineItemType.HISTORY && item.changes === null,
      ),
    ).toBe(true);
  });

  it('USER no puede consultar un ticket ajeno y no se leen las tablas del timeline', async () => {
    ticketsService.findOne.mockRejectedValue(
      new ForbiddenException('No tienes acceso a este ticket'),
    );

    await expect(
      service.findAll(makeUser({ id: 'user-other' }), TICKET_ID, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.comment.findMany).not.toHaveBeenCalled();
    expect(prisma.ticketHistory.findMany).not.toHaveBeenCalled();
  });

  it('ticket inexistente o de otra organización propaga 404 y no consulta el timeline', async () => {
    ticketsService.findOne.mockRejectedValue(
      new NotFoundException('Ticket no encontrado'),
    );

    await expect(
      service.findAll(makeUser({ organizationId: ORG_B }), TICKET_ID, {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('todas las lecturas de Comment y TicketHistory incluyen organizationId + ticketId', async () => {
    await service.findAll(makeUser(), TICKET_ID, {});

    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          organizationId: ORG_A,
          ticketId: TICKET_ID,
        }),
      }),
    );
    expect(prisma.ticketHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG_A, ticketId: TICKET_ID },
      }),
    );
  });

  it('resuelve actores de TicketHistory verificando organizationId', async () => {
    prisma.ticketHistory.findMany.mockResolvedValue([updatedHistory]);
    prisma.user.findMany.mockResolvedValue([
      { id: 'admin-1', fullName: 'Admin Uno', role: UserRole.ADMIN },
    ]);

    const result = await service.findAll(
      makeUser({ role: UserRole.ADMIN }),
      TICKET_ID,
      {},
    );

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { organizationId: ORG_A, id: { in: ['admin-1'] } },
      select: { id: true, fullName: true, role: true },
    });
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        actor: { id: 'admin-1', name: 'Admin Uno', role: UserRole.ADMIN },
      }),
    );
  });

  it('no filtra datos de un actor que no fue encontrado dentro de la organización', async () => {
    prisma.ticketHistory.findMany.mockResolvedValue([updatedHistory]);
    prisma.user.findMany.mockResolvedValue([]);

    const result = await service.findAll(
      makeUser({ role: UserRole.ADMIN }),
      TICKET_ID,
      {},
    );

    expect(result.data[0]).toEqual(expect.objectContaining({ actor: null }));
    expect(result.data[0]).not.toHaveProperty('changedById');
  });

  it('combina Comment + TicketHistory y ordena cronológicamente en ascendente por defecto', async () => {
    prisma.comment.findMany.mockResolvedValue([publicComment]);
    prisma.ticketHistory.findMany.mockResolvedValue([
      {
        ...updatedHistory,
        occurredAt: new Date('2026-08-01T09:59:00.000Z'),
      },
    ]);

    const result = await service.findAll(
      makeUser({ role: UserRole.ADMIN }),
      TICKET_ID,
      {},
    );

    expect(result.data.map((item) => item.id)).toEqual([
      'history-updated',
      'comment-public',
    ]);
  });

  it('usa timestamp, COMMENT antes que HISTORY e id como desempate determinista', async () => {
    const timestamp = new Date('2026-08-01T10:00:00.000Z');
    prisma.comment.findMany.mockResolvedValue([
      { ...publicComment, id: 'comment-b', createdAt: timestamp },
      { ...publicComment, id: 'comment-a', createdAt: timestamp },
    ]);
    prisma.ticketHistory.findMany.mockResolvedValue([
      { ...updatedHistory, id: 'history-b', occurredAt: timestamp },
      { ...updatedHistory, id: 'history-a', occurredAt: timestamp },
    ]);

    const result = await service.findAll(
      makeUser({ role: UserRole.ADMIN }),
      TICKET_ID,
      {},
    );

    expect(result.data.map((item) => item.id)).toEqual([
      'comment-a',
      'comment-b',
      'history-a',
      'history-b',
    ]);
  });

  it('mantiene COMMENT antes que HISTORY en empates también con order=desc', async () => {
    const timestamp = new Date('2026-08-01T10:00:00.000Z');
    prisma.comment.findMany.mockResolvedValue([
      { ...publicComment, createdAt: timestamp },
    ]);
    prisma.ticketHistory.findMany.mockResolvedValue([
      { ...updatedHistory, occurredAt: timestamp },
    ]);

    const result = await service.findAll(
      makeUser({ role: UserRole.ADMIN }),
      TICKET_ID,
      { order: SortOrder.DESC },
    );

    expect(result.data.map((item) => item.type)).toEqual([
      TicketTimelineItemType.COMMENT,
      TicketTimelineItemType.HISTORY,
    ]);
  });

  it('aplica la paginación después de combinar ambas fuentes', async () => {
    prisma.comment.findMany.mockResolvedValue([
      {
        ...publicComment,
        id: 'comment-1',
        createdAt: new Date('2026-08-01T10:00:00.000Z'),
      },
      {
        ...publicComment,
        id: 'comment-3',
        createdAt: new Date('2026-08-01T10:02:00.000Z'),
      },
      {
        ...publicComment,
        id: 'comment-5',
        createdAt: new Date('2026-08-01T10:04:00.000Z'),
      },
    ]);
    prisma.ticketHistory.findMany.mockResolvedValue([
      {
        ...updatedHistory,
        id: 'history-2',
        occurredAt: new Date('2026-08-01T10:01:00.000Z'),
      },
      {
        ...updatedHistory,
        id: 'history-4',
        occurredAt: new Date('2026-08-01T10:03:00.000Z'),
      },
    ]);

    const result = await service.findAll(
      makeUser({ role: UserRole.ADMIN }),
      TICKET_ID,
      { page: 2, limit: 2 },
    );

    expect(result.data.map((item) => item.id)).toEqual([
      'comment-3',
      'history-4',
    ]);
    expect(result.meta).toEqual({
      total: 5,
      page: 2,
      limit: 2,
      totalPages: 3,
    });
  });

  it('devuelve un timeline vacío con meta coherente', async () => {
    const result = await service.findAll(makeUser(), TICKET_ID, {});

    expect(result).toEqual({
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 1 },
    });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('FIRST_RESPONSE coexiste con el Comment que lo originó sin deduplicación', async () => {
    const timestamp = new Date('2026-08-01T10:00:00.000Z');
    prisma.comment.findMany.mockResolvedValue([
      { ...publicComment, id: 'comment-first', createdAt: timestamp },
    ]);
    prisma.ticketHistory.findMany.mockResolvedValue([
      {
        id: 'history-first-response',
        changedById: 'tech-1',
        action: TicketHistoryAction.FIRST_RESPONSE,
        changes: {
          firstResponseAt: { from: null, to: timestamp.toISOString() },
          triggerCommentId: { from: null, to: 'comment-first' },
        },
        occurredAt: timestamp,
      },
    ]);

    const result = await service.findAll(makeUser(), TICKET_ID, {});

    expect(result.data).toHaveLength(2);
    expect(result.data.map((item) => item.type)).toEqual([
      TicketTimelineItemType.COMMENT,
      TicketTimelineItemType.HISTORY,
    ]);
    expect(result.data[1]).toEqual(
      expect.objectContaining({
        action: TicketHistoryAction.FIRST_RESPONSE,
        changes: {
          firstResponseAt: { from: null, to: timestamp.toISOString() },
        },
      }),
    );
  });
});
