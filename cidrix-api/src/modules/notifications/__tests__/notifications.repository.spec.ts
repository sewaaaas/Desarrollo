import { NotificationType } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { NotificationsRepository } from '../notifications.repository';

describe('NotificationsRepository', () => {
  let repository: NotificationsRepository;
  let prisma: {
    notification: {
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
    };
    ticket: { findFirst: jest.Mock };
    user: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      notification: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'notification-1' }),
      },
      ticket: { findFirst: jest.fn().mockResolvedValue(null) },
      user: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest
        .fn()
        .mockImplementation(async (operations: Array<Promise<unknown>>) =>
          Promise.all(operations),
        ),
    };
    repository = new NotificationsRepository(
      prisma as unknown as PrismaService,
    );
  });

  it.each([
    [undefined, undefined],
    [true, { not: null }],
    [false, null],
  ])('lista con tenant+user y filtro isRead=%p', async (isRead, readAt) => {
    await repository.findMany({
      organizationId: 'org-a',
      userId: 'user-1',
      page: 2,
      limit: 20,
      isRead,
    });

    const expectedWhere = {
      organizationId: 'org-a',
      userId: 'user-1',
      ...(isRead === undefined ? {} : { readAt }),
    };
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        ticketId: true,
        readAt: true,
        createdAt: true,
        ticket: { select: { number: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 20,
      take: 20,
    });
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it('cuenta unread directamente en DB con tenant+user+readAt null', async () => {
    prisma.notification.count.mockResolvedValue(3);

    await expect(repository.countUnread('org-a', 'user-1')).resolves.toBe(3);
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-a', userId: 'user-1', readAt: null },
    });
  });

  it('busca una notificación propia con tenant+user+id y select mínimo', async () => {
    await repository.findOwn('org-a', 'user-1', 'notification-1');

    expect(prisma.notification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'notification-1',
          organizationId: 'org-a',
          userId: 'user-1',
        },
      }),
    );
  });

  it('mark read y read-all usan updateMany tenant-aware e idempotente', async () => {
    prisma.notification.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 4 });
    const now = new Date('2026-08-30T12:00:00.000Z');

    await expect(
      repository.markRead('org-a', 'user-1', 'notification-1', now),
    ).resolves.toBe(1);
    await expect(repository.markAllRead('org-a', 'user-1', now)).resolves.toBe(
      4,
    );
    expect(prisma.notification.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'notification-1',
        organizationId: 'org-a',
        userId: 'user-1',
        readAt: null,
      },
      data: { readAt: now },
    });
    expect(prisma.notification.updateMany).toHaveBeenNthCalledWith(2, {
      where: { organizationId: 'org-a', userId: 'user-1', readAt: null },
      data: { readAt: now },
    });
  });

  it('crea solo los campos aprobados con las tres claves de alcance', async () => {
    const data = {
      organizationId: 'org-a',
      userId: 'user-1',
      ticketId: 'ticket-1',
      type: NotificationType.COMMENT_ADDED,
      title: 'Nuevo comentario',
      message: 'Hay un nuevo comentario en TKT-0001',
    };

    await repository.create(data);

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data,
      select: { id: true },
    });
  });

  it('resuelve ticket y usuarios con organizationId+id y selects mínimos', async () => {
    await repository.findTicketContext('org-a', 'ticket-1');
    await repository.findUserContext('org-a', 'user-1');

    expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org-a', id: 'ticket-1' },
      select: {
        id: true,
        number: true,
        createdById: true,
        assignedToId: true,
      },
    });
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org-a', id: 'user-1' },
      select: { id: true, role: true, status: true, deletedAt: true },
    });
  });
});
