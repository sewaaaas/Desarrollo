import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CommentVisibility, TicketStatus, UserRole } from '@prisma/client';
import { EVENTS, CommentAddedEvent, TicketFirstResponseEvent } from '@integrations/events/event-types';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';
import { TicketsService } from '@modules/tickets/tickets.service';
import { CommentsRepository, LockedTicketRow } from './comments.repository';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentFiltersDto } from './dto/comment-filters.dto';
import { CommentResponseDto, PaginatedCommentsDto } from './dto/comment-response.dto';

interface CommentWithAuthor {
  id: string;
  ticketId: string;
  content: string;
  visibility: CommentVisibility;
  createdAt: Date;
  author: { id: string; fullName: string; role: UserRole };
}

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    private readonly commentsRepository: CommentsRepository,
    private readonly ticketsService: TicketsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ---------------------------------------------------------------------------
  // Crear comentario (POST)
  // ---------------------------------------------------------------------------

  async create(
    currentUser: RequestUser,
    ticketId: string,
    dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    const { comment, firstResponseTriggered } = await this.commentsRepository.runTransaction(
      async (tx) => {
        // Carrera adicional (más allá de firstResponseAt): el ticket podría
        // cerrarse, cancelarse o reasignarse entre la validación y la
        // creación del comentario. Se bloquea la fila con SELECT ... FOR
        // UPDATE y se revalida todo dentro de la transacción, no antes.
        //
        // No se usa TicketsService.findOne() aquí: es una lectura no
        // transaccional sin lock, así que no cerraría esta carrera. El
        // pipeline de escritura vive en CommentsRepository/CommentsService.
        const ticket = await this.commentsRepository.lockTicketForUpdate(
          tx,
          ticketId,
          currentUser.organizationId,
        );

        if (!ticket || ticket.organizationId !== currentUser.organizationId) {
          throw new NotFoundException('Ticket no encontrado');
        }

        this.assertCanWrite(currentUser, ticket);

        if (ticket.status === TicketStatus.CLOSED || ticket.status === TicketStatus.CANCELLED) {
          throw new ConflictException(
            'No se pueden agregar comentarios a un ticket cerrado o cancelado',
          );
        }

        if (currentUser.role === UserRole.USER && dto.visibility !== CommentVisibility.PUBLIC) {
          throw new ForbiddenException('Los usuarios solo pueden crear comentarios públicos');
        }

        const created = await this.commentsRepository.createComment(tx, {
          organizationId: currentUser.organizationId,
          ticketId,
          authorId: currentUser.id,
          content: dto.content,
          visibility: dto.visibility,
        });

        let triggered = false;

        const isFirstResponseCandidate =
          dto.visibility === CommentVisibility.PUBLIC &&
          (currentUser.role === UserRole.TECHNICIAN || currentUser.role === UserRole.ADMIN);

        if (isFirstResponseCandidate) {
          const won = await this.commentsRepository.trySetFirstResponse(
            tx,
            currentUser.organizationId,
            ticketId,
            created.createdAt,
          );

          if (won) {
            await this.commentsRepository.createFirstResponseHistory(tx, {
              ticketId,
              organizationId: currentUser.organizationId,
              changedById: currentUser.id,
              firstResponseAt: created.createdAt,
              triggerCommentId: created.id,
            });
            triggered = true;
          }
        }

        return { comment: created, firstResponseTriggered: triggered };
      },
    );

    // Post-commit exclusivamente: si la transacción revirtió, esta línea
    // nunca se alcanza y no se emite ningún evento.
    this.emitPostCommitEvents(currentUser, ticketId, comment, firstResponseTriggered);

    this.logger.log(
      `Comentario creado: ${comment.id} (ticket: ${ticketId}, org: ${currentUser.organizationId})`,
    );

    return this.toResponseDto(comment);
  }

  // ---------------------------------------------------------------------------
  // Listar comentarios (GET)
  // ---------------------------------------------------------------------------

  async findAll(
    currentUser: RequestUser,
    ticketId: string,
    filters: CommentFiltersDto,
  ): Promise<PaginatedCommentsDto> {
    // Reutiliza TicketsService.findOne: ya resuelve exactamente el pipeline
    // de lectura que necesitamos (404 fuera de la organización, 403 si un
    // USER intenta ver un ticket que no es suyo, sin restricción adicional
    // para TECHNICIAN/ADMIN). No hay escritura de por medio, así que no hay
    // carrera que proteger con lock — a diferencia de create().
    await this.ticketsService.findOne(currentUser, ticketId);

    const allowedVisibilities = this.resolveAllowedVisibilities(currentUser, filters.visibility);

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const order = filters.order ?? 'asc';

    const { items, total } = await this.commentsRepository.findManyForTicket({
      organizationId: currentUser.organizationId,
      ticketId,
      allowedVisibilities,
      page,
      limit,
      order,
    });

    return {
      data: items.map((item) => this.toResponseDto(item)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Autorización de escritura (POST) — no delegable a TicketsService.findOne
  // porque debe evaluarse sobre la fila ya bloqueada dentro de la transacción.
  // ---------------------------------------------------------------------------

  /**
   *   - USER: solo en tickets propios (createdById).
   *   - TECHNICIAN: solo en tickets asignados directamente a él (assignedToId)
   *     — más estricto que su alcance de lectura, que sí es toda la
   *     organización (ver findAll).
   *   - ADMIN: cualquier ticket de la organización (ya validada antes de
   *     llamar a este método).
   */
  private assertCanWrite(currentUser: RequestUser, ticket: LockedTicketRow): void {
    if (currentUser.role === UserRole.ADMIN) {
      return;
    }

    if (currentUser.role === UserRole.USER) {
      if (ticket.createdById !== currentUser.id) {
        throw new ForbiddenException('No tienes acceso a este ticket');
      }
      return;
    }

    // TECHNICIAN
    if (ticket.assignedToId !== currentUser.id) {
      throw new ForbiddenException('Solo puedes comentar tickets asignados a ti');
    }
  }

  private resolveAllowedVisibilities(
    currentUser: RequestUser,
    requested?: CommentVisibility,
  ): CommentVisibility[] {
    if (currentUser.role === UserRole.USER) {
      // Se ignora deliberadamente cualquier valor solicitado: un USER nunca
      // puede ampliar su alcance a INTERNAL vía query param.
      return [CommentVisibility.PUBLIC];
    }

    return requested ? [requested] : [CommentVisibility.PUBLIC, CommentVisibility.INTERNAL];
  }

  // ---------------------------------------------------------------------------
  // Eventos
  // ---------------------------------------------------------------------------

  private emitPostCommitEvents(
    currentUser: RequestUser,
    ticketId: string,
    comment: CommentWithAuthor,
    firstResponseTriggered: boolean,
  ): void {
    const occurredAt = new Date();

    const commentAddedEvent: CommentAddedEvent = {
      organizationId: currentUser.organizationId,
      occurredAt,
      commentId: comment.id,
      ticketId,
      authorId: currentUser.id,
      isInternal: comment.visibility === CommentVisibility.INTERNAL,
    };
    this.eventEmitter.emit(EVENTS.COMMENT_ADDED, commentAddedEvent);

    if (firstResponseTriggered) {
      const firstResponseEvent: TicketFirstResponseEvent = {
        organizationId: currentUser.organizationId,
        occurredAt,
        ticketId,
        authorId: currentUser.id,
        firstResponseAt: comment.createdAt,
        triggerCommentId: comment.id,
      };
      this.eventEmitter.emit(EVENTS.TICKET_FIRST_RESPONSE, firstResponseEvent);
    }
  }

  // ---------------------------------------------------------------------------
  // Mapeo de respuesta
  // ---------------------------------------------------------------------------

  private toResponseDto(comment: CommentWithAuthor): CommentResponseDto {
    return {
      id: comment.id,
      ticketId: comment.ticketId,
      content: comment.content,
      visibility: comment.visibility,
      createdAt: comment.createdAt,
      author: {
        id: comment.author.id,
        name: comment.author.fullName,
        role: comment.author.role,
      },
    };
  }
}
