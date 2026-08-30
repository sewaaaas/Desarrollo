/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
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
import {
  NotificationRecord,
  NotificationsRepository,
  NotificationTicketContext,
  NotificationUserContext,
} from '../notifications.repository';
import { NotificationsService } from '../notifications.service';

describe('NotificationsService', () => {
  const ORG = 'org-a';
  const TICKET_ID = 'ticket-1';
  const CREATED_BY = 'user-creator';
  const ASSIGNEE = 'tech-assignee';
  const ACTOR = 'admin-actor';
  const NOW = new Date('2026-08-30T10:00:00.000Z');

  let service: NotificationsService;
  let repository: jest.Mocked<NotificationsRepository>;

  const currentUser: RequestUser = {
    id: CREATED_BY,
    email: 'user@example.com',
    role: UserRole.USER,
    organizationId: ORG,
  };

  const ticket: NotificationTicketContext = {
    id: TICKET_ID,
    number: 42,
    createdById: CREATED_BY,
    assignedToId: ASSIGNEE,
  };

  const activeTechnician: NotificationUserContext = {
    id: ASSIGNEE,
    role: UserRole.TECHNICIAN,
    status: UserStatus.ACTIVE,
    deletedAt: null,
  };

  beforeEach(() => {
    repository = {
      findMany: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      countUnread: jest.fn().mockResolvedValue(0),
      findOwn: jest.fn().mockResolvedValue(null),
      markRead: jest.fn().mockResolvedValue(0),
      markAllRead: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue(undefined),
      findTicketContext: jest.fn().mockResolvedValue(ticket),
      findUserContext: jest.fn().mockImplementation((_org, id: string) =>
        Promise.resolve(
          id === ASSIGNEE
            ? activeTechnician
            : {
                id,
                role: id === CREATED_BY ? UserRole.USER : UserRole.ADMIN,
                status: UserStatus.ACTIVE,
                deletedAt: null,
              },
        ),
      ),
    } as unknown as jest.Mocked<NotificationsRepository>;
    service = new NotificationsService(repository);
  });

  describe('HTTP personal', () => {
    it('lista vacía con meta y totalPages=0', async () => {
      await expect(service.list(currentUser, {})).resolves.toEqual({
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });
      expect(repository.findMany).toHaveBeenCalledWith({
        organizationId: ORG,
        userId: CREATED_BY,
        page: 1,
        limit: 20,
        isRead: undefined,
      });
    });

    it('mapea ticketNumber e isRead sin exponer tenant/recipient', async () => {
      const record = makeRecord({ readAt: NOW });
      repository.findMany.mockResolvedValue({ items: [record], total: 21 });

      const result = await service.list(currentUser, {
        page: 2,
        limit: 10,
        isRead: true,
      });

      expect(result.meta).toEqual({
        total: 21,
        page: 2,
        limit: 10,
        totalPages: 3,
      });
      expect(result.data[0]).toEqual({
        id: record.id,
        type: record.type,
        title: record.title,
        message: record.message,
        ticketId: TICKET_ID,
        ticketNumber: 'TKT-0042',
        isRead: true,
        readAt: NOW,
        createdAt: NOW,
      });
      expect(result.data[0]).not.toHaveProperty('organizationId');
      expect(result.data[0]).not.toHaveProperty('userId');
    });

    it('obtiene unread count sin cargar filas', async () => {
      repository.countUnread.mockResolvedValue(5);

      await expect(service.getUnreadCount(currentUser)).resolves.toEqual({
        count: 5,
      });
      expect(repository.countUnread).toHaveBeenCalledWith(ORG, CREATED_BY);
      expect(repository.findMany).not.toHaveBeenCalled();
    });

    it('marca una pendiente y vuelve a leerla en el mismo scope', async () => {
      repository.findOwn
        .mockResolvedValueOnce(makeRecord({ readAt: null }))
        .mockResolvedValueOnce(makeRecord({ readAt: NOW }));
      repository.markRead.mockResolvedValue(1);

      const result = await service.markRead(currentUser, 'notification-1');

      expect(result.isRead).toBe(true);
      expect(repository.markRead).toHaveBeenCalledWith(
        ORG,
        CREATED_BY,
        'notification-1',
        expect.any(Date),
      );
      expect(repository.findOwn).toHaveBeenNthCalledWith(
        2,
        ORG,
        CREATED_BY,
        'notification-1',
      );
    });

    it('mark read repetido conserva readAt y no actualiza', async () => {
      repository.findOwn.mockResolvedValue(makeRecord({ readAt: NOW }));

      await expect(
        service.markRead(currentUser, 'notification-1'),
      ).resolves.toMatchObject({ readAt: NOW, isRead: true });
      expect(repository.markRead).not.toHaveBeenCalled();
    });

    it('retorna 404 uniforme para inexistente, otro usuario u otro tenant', async () => {
      repository.findOwn.mockResolvedValue(null);

      await expect(
        service.markRead(currentUser, 'notification-foreign'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.findOwn).toHaveBeenCalledWith(
        ORG,
        CREATED_BY,
        'notification-foreign',
      );
    });

    it.each([3, 0])('read-all retorna updatedCount=%i', async (count) => {
      repository.markAllRead.mockResolvedValue(count);

      await expect(service.markAllRead(currentUser)).resolves.toEqual({
        updatedCount: count,
      });
      expect(repository.markAllRead).toHaveBeenCalledWith(
        ORG,
        CREATED_BY,
        expect.any(Date),
      );
    });
  });

  describe('assignment', () => {
    it('ticket.created con assignee válido crea TICKET_ASSIGNED', async () => {
      await service.handleTicketCreated(createdEvent());

      expect(repository.create).toHaveBeenCalledWith({
        organizationId: ORG,
        userId: ASSIGNEE,
        ticketId: TICKET_ID,
        type: NotificationType.TICKET_ASSIGNED,
        title: 'Ticket asignado',
        message: 'Se te asignó el ticket TKT-0042',
      });
    });

    it.each([{ assignedTo: null }, { assignedTo: CREATED_BY }])(
      'ticket.created ignora el caso %#',
      async (changes) => {
        await service.handleTicketCreated(createdEvent(changes));
        expect(repository.create).not.toHaveBeenCalled();
      },
    );

    it('A -> B notifica únicamente a B', async () => {
      await service.handleTicketAssigned(assignedEvent());

      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: ASSIGNEE }),
      );
      expect(repository.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'tech-previous' }),
      );
    });

    it.each([
      { assignedTo: 'tech-previous' },
      { assignedTo: null },
      { assignedBy: ASSIGNEE },
    ])('ticket.assigned ignora el caso %#', async (changes) => {
      await service.handleTicketAssigned(assignedEvent(changes));
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('comments', () => {
    it('PUBLIC de USER notifica al assignee sin persistir body', async () => {
      await service.handleCommentAdded(commentEvent({ authorId: CREATED_BY }));

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: ASSIGNEE,
          type: NotificationType.COMMENT_ADDED,
          message: 'Hay un nuevo comentario en TKT-0042',
        }),
      );
      expect(JSON.stringify(repository.create.mock.calls)).not.toContain(
        'contenido',
      );
    });

    it.each([UserRole.ADMIN, UserRole.TECHNICIAN])(
      'PUBLIC de %s notifica al creator',
      async (role) => {
        repository.findUserContext.mockImplementation((_org, id) =>
          Promise.resolve(
            id === ACTOR
              ? { id, role, status: UserStatus.ACTIVE, deletedAt: null }
              : {
                  id,
                  role: UserRole.USER,
                  status: UserStatus.ACTIVE,
                  deletedAt: null,
                },
          ),
        );

        await service.handleCommentAdded(commentEvent({ authorId: ACTOR }));

        expect(repository.create).toHaveBeenCalledWith(
          expect.objectContaining({ userId: CREATED_BY }),
        );
      },
    );

    it('PUBLIC sin assignee y self-comment no crean', async () => {
      repository.findTicketContext.mockResolvedValueOnce({
        ...ticket,
        assignedToId: null,
      });
      await service.handleCommentAdded(commentEvent());
      expect(repository.create).not.toHaveBeenCalled();

      repository.findTicketContext.mockResolvedValueOnce({
        ...ticket,
        assignedToId: CREATED_BY,
      });
      await service.handleCommentAdded(commentEvent());
      expect(repository.create).not.toHaveBeenCalled();
    });

    it.each([UserRole.ADMIN, UserRole.TECHNICIAN])(
      'INTERNAL notifica solo al assignee %s activo',
      async (role) => {
        repository.findUserContext.mockImplementation((_org, id) =>
          Promise.resolve({
            id,
            role: id === ASSIGNEE ? role : UserRole.ADMIN,
            status: UserStatus.ACTIVE,
            deletedAt: null,
          }),
        );

        await service.handleCommentAdded(
          commentEvent({ authorId: ACTOR, isInternal: true }),
        );

        expect(repository.create).toHaveBeenCalledWith({
          organizationId: ORG,
          userId: ASSIGNEE,
          ticketId: TICKET_ID,
          type: NotificationType.COMMENT_ADDED,
          title: 'Nueva nota interna en ticket',
          message: 'Nueva nota interna en TKT-0042',
        });
      },
    );

    it.each([
      [UserRole.USER, ASSIGNEE],
      [UserRole.TECHNICIAN, ACTOR],
    ])('INTERNAL no crea para role=%s', async (role, assignedToId) => {
      repository.findTicketContext.mockResolvedValue({
        ...ticket,
        assignedToId,
      });
      repository.findUserContext.mockImplementation((_org, id) =>
        Promise.resolve({
          id,
          role: id === assignedToId ? role : UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          deletedAt: null,
        }),
      );

      await service.handleCommentAdded(
        commentEvent({ authorId: ACTOR, isInternal: true }),
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('INTERNAL sin assignee nunca notifica al creator USER', async () => {
      repository.findTicketContext.mockResolvedValue({
        ...ticket,
        assignedToId: null,
      });

      await service.handleCommentAdded(
        commentEvent({ authorId: ACTOR, isInternal: true }),
      );

      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.findUserContext).not.toHaveBeenCalledWith(
        ORG,
        CREATED_BY,
      );
    });
  });

  describe('status', () => {
    it.each([
      TicketStatus.IN_PROGRESS,
      TicketStatus.PENDING,
      TicketStatus.RESOLVED,
      TicketStatus.CLOSED,
      TicketStatus.CANCELLED,
    ])('notifica al creator al cambiar hacia %s', async (to) => {
      await service.handleTicketStatusChanged(statusEvent({ to }));

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: CREATED_BY,
          type: NotificationType.TICKET_STATUS_CHANGED,
          message: `El ticket TKT-0042 cambió de OPEN a ${to}`,
        }),
      );
      repository.create.mockClear();
    });

    it.each([
      { from: TicketStatus.PENDING, to: TicketStatus.PENDING },
      { changedBy: CREATED_BY },
      { to: TicketStatus.OPEN },
    ])('no crea status para el caso %#', async (changes) => {
      await service.handleTicketStatusChanged(statusEvent(changes));
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('fail-closed recipient y tenant', () => {
    it.each([
      [UserStatus.INACTIVE, null],
      [UserStatus.ACTIVE, NOW],
      [UserStatus.DELETED, NOW],
    ])('suprime recipient status=%s', async (status, deletedAt) => {
      repository.findUserContext.mockResolvedValue({
        ...activeTechnician,
        status,
        deletedAt,
      });

      await service.handleTicketCreated(createdEvent());
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('suprime recipient de otro tenant o inexistente', async () => {
      repository.findUserContext.mockResolvedValue(null);

      await service.handleTicketCreated(createdEvent());

      expect(repository.findUserContext).toHaveBeenCalledWith(ORG, ASSIGNEE);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('suprime contexto de ticket inexistente/cross-tenant', async () => {
      repository.findTicketContext.mockResolvedValue(null);

      await service.handleTicketCreated(createdEvent());

      expect(repository.findTicketContext).toHaveBeenCalledWith(ORG, TICKET_ID);
      expect(repository.findUserContext).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  function makeRecord(
    overrides: Partial<NotificationRecord> = {},
  ): NotificationRecord {
    return {
      id: 'notification-1',
      type: NotificationType.COMMENT_ADDED,
      title: 'Nuevo comentario en ticket',
      message: 'Hay un nuevo comentario en TKT-0042',
      ticketId: TICKET_ID,
      readAt: null,
      createdAt: NOW,
      ticket: { number: 42 },
      ...overrides,
    };
  }

  function createdEvent(
    overrides: Partial<TicketCreatedEvent> = {},
  ): TicketCreatedEvent {
    return {
      organizationId: ORG,
      ticketId: TICKET_ID,
      ticketNumber: 'TKT-0042',
      priority: 'MEDIUM',
      categoryId: null,
      createdBy: CREATED_BY,
      assignedTo: ASSIGNEE,
      slaPolicyId: null,
      occurredAt: NOW,
      ...overrides,
    };
  }

  function assignedEvent(
    overrides: Partial<TicketAssignedEvent> = {},
  ): TicketAssignedEvent {
    return {
      organizationId: ORG,
      ticketId: TICKET_ID,
      assignedTo: ASSIGNEE,
      assignedBy: ACTOR,
      previousAssignee: 'tech-previous',
      occurredAt: NOW,
      ...overrides,
    };
  }

  function commentEvent(
    overrides: Partial<CommentAddedEvent> = {},
  ): CommentAddedEvent {
    return {
      organizationId: ORG,
      ticketId: TICKET_ID,
      commentId: 'comment-1',
      authorId: CREATED_BY,
      isInternal: false,
      occurredAt: NOW,
      ...overrides,
    };
  }

  function statusEvent(
    overrides: Partial<TicketStatusChangedEvent> = {},
  ): TicketStatusChangedEvent {
    return {
      organizationId: ORG,
      ticketId: TICKET_ID,
      from: TicketStatus.OPEN,
      to: TicketStatus.IN_PROGRESS,
      changedBy: ACTOR,
      occurredAt: NOW,
      ...overrides,
    };
  }
});
