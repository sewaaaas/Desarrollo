import { ForbiddenException, ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CommentVisibility, TicketStatus, UserRole } from '@prisma/client';
import { CommentsService } from '../comments.service';
import { CommentsRepository, LockedTicketRow } from '../comments.repository';
import { TicketsService } from '@modules/tickets/tickets.service';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';
import { EVENTS } from '@integrations/events/event-types';

/**
 * CommentsRepository y TicketsService se mockean por completo — estas
 * pruebas verifican exclusivamente las reglas de negocio de CommentsService
 * (autorización, visibilidad, estados, disparo de firstResponseAt y eventos
 * post-commit), no el acceso real a base de datos ni la lógica interna de
 * TicketsService (que tiene sus propias pruebas).
 */
describe('CommentsService', () => {
  let service: CommentsService;
  let repository: jest.Mocked<CommentsRepository>;
  let ticketsService: jest.Mocked<TicketsService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const ORG_A = 'org-a';
  const ORG_B = 'org-b';

  const baseTicket: LockedTicketRow = {
    id: 'ticket-1',
    organizationId: ORG_A,
    status: TicketStatus.OPEN,
    createdById: 'user-owner',
    assignedToId: 'tech-assigned',
    firstResponseAt: null,
  };

  const createdComment = {
    id: 'comment-1',
    ticketId: 'ticket-1',
    content: 'Hola, ¿alguna novedad?',
    visibility: CommentVisibility.PUBLIC,
    createdAt: new Date('2026-07-28T10:00:00.000Z'),
    author: { id: 'author-1', fullName: 'Ana Técnica', role: UserRole.TECHNICIAN },
  };

  function makeUser(overrides: Partial<RequestUser>): RequestUser {
    return {
      id: 'user-x',
      email: 'x@cidrix.test',
      role: UserRole.USER,
      organizationId: ORG_A,
      ...overrides,
    };
  }

  beforeEach(() => {
    repository = {
      runTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn({})),
      lockTicketForUpdate: jest.fn(),
      createComment: jest.fn(),
      trySetFirstResponse: jest.fn(),
      createFirstResponseHistory: jest.fn(),
      findManyForTicket: jest.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    ticketsService = {
      findOne: jest.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    eventEmitter = {
      emit: jest.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    service = new CommentsService(repository, ticketsService, eventEmitter);
  });

  // ---------------------------------------------------------------------------
  // Aislamiento multi-tenant (POST)
  // ---------------------------------------------------------------------------

  it('POST responde 404 si el ticket no existe o pertenece a otro tenant (el WHERE ya filtra por organizationId, no solo la comparación posterior)', async () => {
    // Con la corrección, lockTicketForUpdate incluye organizationId en el
    // WHERE de la query, así que un ticket de otra organización simplemente
    // no matchea ninguna fila — el repository devuelve null, igual que si
    // el ticket no existiera en absoluto.
    repository.lockTicketForUpdate.mockResolvedValue(null);
    const user = makeUser({ role: UserRole.ADMIN, organizationId: ORG_A });

    await expect(
      service.create(user, 'ticket-1', { content: 'hola', visibility: CommentVisibility.PUBLIC }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('POST pasa organizationId del usuario actual a lockTicketForUpdate (aislamiento tenant en la query, no solo después)', async () => {
    repository.lockTicketForUpdate.mockResolvedValue(baseTicket);
    repository.createComment.mockResolvedValue(createdComment);
    const user = makeUser({ id: 'admin-1', role: UserRole.ADMIN, organizationId: ORG_A });

    await service.create(user, 'ticket-1', { content: 'hola', visibility: CommentVisibility.PUBLIC });

    expect(repository.lockTicketForUpdate).toHaveBeenCalledWith(
      expect.anything(),
      'ticket-1',
      ORG_A,
    );
  });

  it('POST responde 404 igual si, por un fallo defensivo hipotético, el repository devolviera una fila de otra organización (defensa adicional, no el único filtro)', async () => {
    repository.lockTicketForUpdate.mockResolvedValue({ ...baseTicket, organizationId: ORG_B });
    const user = makeUser({ role: UserRole.ADMIN, organizationId: ORG_A });

    await expect(
      service.create(user, 'ticket-1', { content: 'hola', visibility: CommentVisibility.PUBLIC }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('POST responde 404 si el ticket no existe', async () => {
    repository.lockTicketForUpdate.mockResolvedValue(null);
    const user = makeUser({ role: UserRole.ADMIN });

    await expect(
      service.create(user, 'ticket-x', { content: 'hola', visibility: CommentVisibility.PUBLIC }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('GET propaga el 404/403 de TicketsService.findOne tal cual (aislamiento multi-tenant y RBAC delegados)', async () => {
    ticketsService.findOne.mockRejectedValue(new NotFoundException('Ticket no encontrado'));
    const user = makeUser({ role: UserRole.ADMIN });

    await expect(
      service.findAll(user, 'ticket-x', { page: 1, limit: 20, order: 'asc' as never }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findManyForTicket).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // RBAC de escritura (POST)
  // ---------------------------------------------------------------------------

  it('USER puede comentar su propio ticket', async () => {
    repository.lockTicketForUpdate.mockResolvedValue(baseTicket);
    repository.createComment.mockResolvedValue(createdComment);
    const user = makeUser({ id: 'user-owner', role: UserRole.USER });

    await expect(
      service.create(user, 'ticket-1', { content: 'hola', visibility: CommentVisibility.PUBLIC }),
    ).resolves.toBeDefined();
  });

  it('USER NO puede comentar el ticket de otro usuario (403, mismo tenant)', async () => {
    repository.lockTicketForUpdate.mockResolvedValue(baseTicket);
    const user = makeUser({ id: 'user-other', role: UserRole.USER });

    await expect(
      service.create(user, 'ticket-1', { content: 'hola', visibility: CommentVisibility.PUBLIC }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('TECHNICIAN puede comentar un ticket asignado directamente a él', async () => {
    repository.lockTicketForUpdate.mockResolvedValue(baseTicket);
    repository.createComment.mockResolvedValue(createdComment);
    const user = makeUser({ id: 'tech-assigned', role: UserRole.TECHNICIAN });

    await expect(
      service.create(user, 'ticket-1', { content: 'hola', visibility: CommentVisibility.PUBLIC }),
    ).resolves.toBeDefined();
  });

  it('TECHNICIAN NO puede comentar un ticket de su organización si no está asignado a él (403), aunque pueda LEERLO', async () => {
    repository.lockTicketForUpdate.mockResolvedValue(baseTicket);
    const user = makeUser({ id: 'tech-other', role: UserRole.TECHNICIAN });

    await expect(
      service.create(user, 'ticket-1', { content: 'hola', visibility: CommentVisibility.PUBLIC }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('ADMIN puede comentar cualquier ticket de su organización', async () => {
    repository.lockTicketForUpdate.mockResolvedValue(baseTicket);
    repository.createComment.mockResolvedValue(createdComment);
    const user = makeUser({ id: 'admin-1', role: UserRole.ADMIN });

    await expect(
      service.create(user, 'ticket-1', { content: 'hola', visibility: CommentVisibility.PUBLIC }),
    ).resolves.toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // RBAC de lectura (GET) — delegado a TicketsService.findOne, pero se
  // verifica que CommentsService lo invoque y respete su resultado.
  // ---------------------------------------------------------------------------

  it('TECHNICIAN puede LISTAR comentarios de cualquier ticket de su organización, aunque no esté asignado', async () => {
    ticketsService.findOne.mockResolvedValue({ id: 'ticket-1' } as never);
    repository.findManyForTicket.mockResolvedValue({ items: [], total: 0 });
    const user = makeUser({ id: 'tech-other', role: UserRole.TECHNICIAN });

    await expect(
      service.findAll(user, 'ticket-1', { page: 1, limit: 20, order: 'asc' as never }),
    ).resolves.toBeDefined();
    expect(ticketsService.findOne).toHaveBeenCalledWith(user, 'ticket-1');
  });

  // ---------------------------------------------------------------------------
  // Visibilidad
  // ---------------------------------------------------------------------------

  it('USER enviando visibility=INTERNAL recibe 403', async () => {
    repository.lockTicketForUpdate.mockResolvedValue(baseTicket);
    const user = makeUser({ id: 'user-owner', role: UserRole.USER });

    await expect(
      service.create(user, 'ticket-1', { content: 'hola', visibility: CommentVisibility.INTERNAL }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('TECHNICIAN puede crear notas INTERNAL en un ticket asignado', async () => {
    repository.lockTicketForUpdate.mockResolvedValue(baseTicket);
    repository.createComment.mockResolvedValue({
      ...createdComment,
      visibility: CommentVisibility.INTERNAL,
    });
    const user = makeUser({ id: 'tech-assigned', role: UserRole.TECHNICIAN });

    await expect(
      service.create(user, 'ticket-1', { content: 'nota interna', visibility: CommentVisibility.INTERNAL }),
    ).resolves.toBeDefined();
  });

  it('USER nunca recibe comentarios INTERNAL al listar, aunque los solicite por query param', async () => {
    ticketsService.findOne.mockResolvedValue({ id: 'ticket-1' } as never);
    repository.findManyForTicket.mockResolvedValue({ items: [], total: 0 });
    const user = makeUser({ id: 'user-owner', role: UserRole.USER });

    await service.findAll(user, 'ticket-1', {
      visibility: CommentVisibility.INTERNAL,
      page: 1,
      limit: 20,
      order: 'asc' as never,
    });

    expect(repository.findManyForTicket).toHaveBeenCalledWith(
      expect.objectContaining({ allowedVisibilities: [CommentVisibility.PUBLIC] }),
    );
  });

  // ---------------------------------------------------------------------------
  // Estados terminales
  // ---------------------------------------------------------------------------

  it.each([TicketStatus.CLOSED, TicketStatus.CANCELLED])(
    'bloquea comentarios sobre ticket en estado %s con 409, incluso para ADMIN',
    async (status) => {
      repository.lockTicketForUpdate.mockResolvedValue({ ...baseTicket, status });
      const user = makeUser({ role: UserRole.ADMIN });

      await expect(
        service.create(user, 'ticket-1', { content: 'hola', visibility: CommentVisibility.PUBLIC }),
      ).rejects.toBeInstanceOf(ConflictException);
    },
  );

  // ---------------------------------------------------------------------------
  // firstResponseAt
  // ---------------------------------------------------------------------------

  it('dispara firstResponseAt en el primer comentario PUBLIC de TECHNICIAN y emite el evento', async () => {
    repository.lockTicketForUpdate.mockResolvedValue(baseTicket);
    repository.createComment.mockResolvedValue(createdComment);
    repository.trySetFirstResponse.mockResolvedValue(true);
    const user = makeUser({ id: 'tech-assigned', role: UserRole.TECHNICIAN });

    await service.create(user, 'ticket-1', { content: 'respuesta', visibility: CommentVisibility.PUBLIC });

    expect(repository.createFirstResponseHistory).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      EVENTS.TICKET_FIRST_RESPONSE,
      expect.objectContaining({ ticketId: 'ticket-1', authorId: 'tech-assigned' }),
    );
  });

  it('NO crea TicketHistory ni emite el evento de primera respuesta si otra transacción ya la registró', async () => {
    repository.lockTicketForUpdate.mockResolvedValue(baseTicket);
    repository.createComment.mockResolvedValue(createdComment);
    repository.trySetFirstResponse.mockResolvedValue(false); // perdió la carrera
    const user = makeUser({ id: 'tech-assigned', role: UserRole.TECHNICIAN });

    await service.create(user, 'ticket-1', { content: 'respuesta', visibility: CommentVisibility.PUBLIC });

    expect(repository.createFirstResponseHistory).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      EVENTS.TICKET_FIRST_RESPONSE,
      expect.anything(),
    );
  });

  it('las notas INTERNAL nunca disparan firstResponseAt, aunque sean de TECHNICIAN/ADMIN', async () => {
    repository.lockTicketForUpdate.mockResolvedValue(baseTicket);
    repository.createComment.mockResolvedValue({ ...createdComment, visibility: CommentVisibility.INTERNAL });
    const user = makeUser({ id: 'tech-assigned', role: UserRole.TECHNICIAN });

    await service.create(user, 'ticket-1', { content: 'nota interna', visibility: CommentVisibility.INTERNAL });

    expect(repository.trySetFirstResponse).not.toHaveBeenCalled();
  });

  it('las respuestas de USER nunca disparan firstResponseAt', async () => {
    repository.lockTicketForUpdate.mockResolvedValue(baseTicket);
    repository.createComment.mockResolvedValue({
      ...createdComment,
      author: { ...createdComment.author, role: UserRole.USER },
    });
    const user = makeUser({ id: 'user-owner', role: UserRole.USER });

    await service.create(user, 'ticket-1', { content: 'gracias', visibility: CommentVisibility.PUBLIC });

    expect(repository.trySetFirstResponse).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Eventos siempre post-"commit"
  // ---------------------------------------------------------------------------

  it('no emite ningún evento si la transacción lanza (rollback simulado)', async () => {
    repository.lockTicketForUpdate.mockResolvedValue(null); // fuerza NotFoundException dentro de la tx
    const user = makeUser({ role: UserRole.ADMIN });

    await expect(
      service.create(user, 'ticket-x', { content: 'hola', visibility: CommentVisibility.PUBLIC }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
