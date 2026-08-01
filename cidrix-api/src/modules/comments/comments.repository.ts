import { Injectable } from '@nestjs/common';
import { CommentVisibility, Prisma, TicketHistoryAction } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';

/**
 * Fila del ticket obtenida mediante SELECT ... FOR UPDATE.
 * Solo los campos que CommentsService necesita para autorizar y decidir
 * el efecto colateral de firstResponseAt.
 */
export interface LockedTicketRow {
  id: string;
  organizationId: string;
  status: string;
  createdById: string;
  assignedToId: string | null;
  firstResponseAt: Date | null;
}

export interface CreateCommentData {
  organizationId: string;
  ticketId: string;
  authorId: string;
  content: string;
  visibility: CommentVisibility;
}

export interface FindManyOptions {
  organizationId: string;
  ticketId: string;
  allowedVisibilities: CommentVisibility[];
  page: number;
  limit: number;
  order: 'asc' | 'desc';
}

const COMMENT_SELECT = {
  id: true,
  ticketId: true,
  content: true,
  visibility: true,
  createdAt: true,
  author: {
    select: { id: true, fullName: true, role: true },
  },
} as const;

@Injectable()
export class CommentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Abre la transacción que engloba todo el flujo de creación de un
   * comentario. CommentsService orquesta las reglas de negocio dentro de
   * este callback; este método solo delega en Prisma.
   */
  runTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  /**
   * SELECT ... FOR UPDATE parametrizado sobre la fila del ticket.
   *
   * Bloquea la fila hasta que la transacción confirme o revierta, evitando
   * que el ticket cambie de estado/organización/asignación entre la
   * validación y la creación del comentario. NO resuelve la carrera de
   * firstResponseAt (esa se resuelve con el UPDATE condicional de
   * trySetFirstResponse) — este lock es exclusivamente para consistencia de
   * estado/tenant/asignación frente a la creación del comentario.
   *
   * `organizationId` va DIRECTAMENTE en el WHERE (no solo como comparación
   * posterior en el service): ningún request debe siquiera poder bloquear
   * una fila de otra organización. Si el ticket no existe o pertenece a otro
   * tenant, esta query no devuelve filas — CommentsService responde 404 en
   * ambos casos sin distinguirlos. La comparación posterior
   * `ticket.organizationId !== currentUser.organizationId` en
   * CommentsService queda como defensa adicional, no como el único filtro.
   *
   * No se usa TicketsService.findOne() aquí a propósito: esa lectura no es
   * transaccional ni toma lock, así que no cerraría la carrera que este
   * método sí cierra. Se reutiliza TicketsService solo en el camino de
   * lectura (GET), donde no hay escritura y por lo tanto no hay carrera que
   * proteger — ver CommentsService.findAll.
   */
  async lockTicketForUpdate(
    tx: Prisma.TransactionClient,
    ticketId: string,
    organizationId: string,
  ): Promise<LockedTicketRow | null> {
    const rows = await tx.$queryRaw<LockedTicketRow[]>`
      SELECT
        "id"                 AS "id",
        "organization_id"    AS "organizationId",
        "status"::text       AS "status",
        "created_by_id"      AS "createdById",
        "assigned_to_id"     AS "assignedToId",
        "first_response_at"  AS "firstResponseAt"
      FROM "tickets"
      WHERE "id" = ${ticketId}
        AND "organization_id" = ${organizationId}
      FOR UPDATE
    `;

    return rows[0] ?? null;
  }

  async createComment(tx: Prisma.TransactionClient, data: CreateCommentData) {
    return tx.comment.create({
      data: {
        organizationId: data.organizationId,
        ticketId: data.ticketId,
        authorId: data.authorId,
        content: data.content,
        visibility: data.visibility,
      },
      select: COMMENT_SELECT,
    });
  }

  /**
   * Update atómico condicionado por firstResponseAt IS NULL (compare-and-swap
   * a nivel de base de datos). Devuelve true únicamente si ESTA llamada fue
   * la que ganó la carrera (afectó una fila). Independiente del lock de
   * lockTicketForUpdate: son dos mecanismos de concurrencia distintos.
   *
   * Sigue el mismo patrón que el resto de TicketsService (version:
   * {increment: 1} en cada mutación de Ticket), salvo que aquí la condición
   * de éxito es `firstResponseAt IS NULL` en vez de un `version` provisto
   * por el cliente — no hay un valor de version "esperado" que un cliente
   * pueda conocer de antemano para esta mutación disparada por el sistema.
   */
  async trySetFirstResponse(
    tx: Prisma.TransactionClient,
    organizationId: string,
    ticketId: string,
    firstResponseAt: Date,
  ): Promise<boolean> {
    const result = await tx.ticket.updateMany({
      where: { id: ticketId, organizationId, firstResponseAt: null },
      data: {
        firstResponseAt,
        version: { increment: 1 },
      },
    });

    return result.count === 1;
  }

  async createFirstResponseHistory(
    tx: Prisma.TransactionClient,
    params: {
      ticketId: string;
      organizationId: string;
      changedById: string;
      firstResponseAt: Date;
      triggerCommentId: string;
    },
  ): Promise<void> {
    await tx.ticketHistory.create({
      data: {
        ticketId: params.ticketId,
        organizationId: params.organizationId,
        changedById: params.changedById,
        action: TicketHistoryAction.FIRST_RESPONSE,
        changes: {
          firstResponseAt: { from: null, to: params.firstResponseAt.toISOString() },
          triggerCommentId: { from: null, to: params.triggerCommentId },
        },
        occurredAt: params.firstResponseAt,
      },
    });
  }

  async findManyForTicket(opts: FindManyOptions): Promise<{
    items: Prisma.CommentGetPayload<{ select: typeof COMMENT_SELECT }>[];
    total: number;
  }> {
    const { organizationId, ticketId, allowedVisibilities, page, limit, order } = opts;

    const where: Prisma.CommentWhereInput = {
      organizationId,
      ticketId,
      visibility: { in: allowedVisibilities },
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        select: COMMENT_SELECT,
        // Orden estable: createdAt + id como desempate, nunca solo createdAt.
        orderBy: [{ createdAt: order }, { id: order }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.comment.count({ where }),
    ]);

    return { items, total };
  }
}
