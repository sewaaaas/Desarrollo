import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommentVisibility, TicketStatus, UserRole } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { StorageConfig } from '@config/storage.config';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';
import { SortOrder } from '@modules/tickets/dto/ticket-filters.dto';
import { TicketResponseDto } from '@modules/tickets/dto/ticket-response.dto';
import { TicketsService } from '@modules/tickets/tickets.service';
import {
  AttachmentsRepository,
  LockedAttachmentTicketRow,
} from './attachments.repository';
import { AttachmentFiltersDto } from './dto/attachment-filters.dto';
import {
  AttachmentResponseDto,
  PaginatedAttachmentsDto,
} from './dto/attachment-response.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { AttachmentStorage } from './storage/attachment-storage.interface';
import { ATTACHMENT_STORAGE } from './storage/attachment-storage.token';
import {
  AttachmentFileValidator,
  UploadedAttachmentFile,
} from './validation/attachment-file.validator';

interface AttachmentComment {
  id: string;
  authorId: string;
  visibility: CommentVisibility;
}

interface AttachmentRecord {
  id: string;
  ticketId: string;
  commentId: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  visibility: CommentVisibility;
  createdAt: Date;
  uploadedBy: { id: string; fullName: string; role: UserRole };
}

export interface AttachmentDownload {
  stream: Readable;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);
  private readonly maxFilesPerTicket: number;
  private readonly maxTotalSizePerTicketBytes: number;

  constructor(
    private readonly repository: AttachmentsRepository,
    private readonly ticketsService: TicketsService,
    private readonly fileValidator: AttachmentFileValidator,
    @Inject(ATTACHMENT_STORAGE)
    private readonly storage: AttachmentStorage,
    configService: ConfigService,
  ) {
    const config = configService.get<StorageConfig>('storage');
    if (!config) {
      throw new Error('Storage configuration could not be loaded');
    }
    this.maxFilesPerTicket = config.maxFilesPerTicket;
    this.maxTotalSizePerTicketBytes = config.maxTotalSizePerTicketBytes;
  }

  async upload(
    currentUser: RequestUser,
    ticketId: string,
    dto: UploadAttachmentDto,
    file: UploadedAttachmentFile | undefined,
  ): Promise<AttachmentResponseDto> {
    const ticket = await this.ticketsService.findOne(currentUser, ticketId);
    this.assertCanWrite(currentUser, ticket);
    this.assertTicketIsWritable(ticket.status);

    const preliminaryComment = dto.commentId
      ? await this.repository.findCommentForTicket(
          currentUser.organizationId,
          ticketId,
          dto.commentId,
        )
      : null;
    const preliminaryVisibility = this.resolveEffectiveVisibility(
      currentUser,
      dto,
      preliminaryComment,
    );
    const validatedFile = this.fileValidator.validate(file);
    const storageKey = `attachments/${randomUUID()}`;
    const sha256 = createHash('sha256')
      .update(validatedFile.buffer)
      .digest('hex');

    await this.storage.put(storageKey, validatedFile.buffer);

    try {
      const attachment = await this.repository.runTransaction(async (tx) => {
        const lockedTicket = await this.repository.lockTicketForUpdate(
          tx,
          currentUser.organizationId,
          ticketId,
        );

        if (!lockedTicket) {
          throw new NotFoundException('Ticket no encontrado');
        }

        this.assertCanWrite(currentUser, lockedTicket);
        this.assertTicketIsWritable(lockedTicket.status);

        const lockedComment = dto.commentId
          ? await this.repository.findCommentForAttachment(
              tx,
              currentUser.organizationId,
              ticketId,
              dto.commentId,
            )
          : null;
        const effectiveVisibility = this.resolveEffectiveVisibility(
          currentUser,
          dto,
          lockedComment,
        );

        if (effectiveVisibility !== preliminaryVisibility) {
          throw new ConflictException(
            'La visibilidad del comentario cambió durante el upload',
          );
        }

        const usage = await this.repository.getActiveUsage(
          tx,
          currentUser.organizationId,
          ticketId,
        );

        if (usage.count >= this.maxFilesPerTicket) {
          throw new ConflictException(
            `El ticket alcanzó el máximo de ${this.maxFilesPerTicket} attachments activos`,
          );
        }

        if (
          usage.totalSizeBytes + validatedFile.size >
          this.maxTotalSizePerTicketBytes
        ) {
          throw new ConflictException(
            `El ticket supera el máximo de ${this.maxTotalSizePerTicketBytes} bytes en attachments activos`,
          );
        }

        return this.repository.createAttachment(tx, {
          organizationId: currentUser.organizationId,
          ticketId,
          commentId: dto.commentId ?? null,
          uploadedById: currentUser.id,
          originalName: validatedFile.normalizedName,
          storageKey,
          mimeType: validatedFile.mimetype,
          sizeBytes: validatedFile.size,
          sha256,
          visibility: effectiveVisibility,
        });
      });

      this.logger.log(
        `Attachment creado: ${attachment.id} (ticket: ${ticketId}, org: ${currentUser.organizationId})`,
      );

      return this.toResponseDto(attachment);
    } catch (error: unknown) {
      try {
        await this.storage.delete(storageKey);
      } catch (cleanupError: unknown) {
        this.logger.error(
          `No se pudo compensar el archivo ${storageKey} después de un fallo de metadata`,
          cleanupError instanceof Error ? cleanupError.stack : undefined,
        );
      }
      throw error;
    }
  }

  async findAll(
    currentUser: RequestUser,
    ticketId: string,
    filters: AttachmentFiltersDto,
  ): Promise<PaginatedAttachmentsDto> {
    await this.ticketsService.findOne(currentUser, ticketId);

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const order = filters.order ?? SortOrder.ASC;
    const allowedVisibilities = this.resolveAllowedVisibilities(
      currentUser,
      filters.visibility,
    );
    const { items, total } = await this.repository.findManyForTicket({
      organizationId: currentUser.organizationId,
      ticketId,
      commentId: filters.commentId,
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

  async download(
    currentUser: RequestUser,
    ticketId: string,
    attachmentId: string,
  ): Promise<AttachmentDownload> {
    await this.ticketsService.findOne(currentUser, ticketId);

    const attachment = await this.repository.findForDownload({
      organizationId: currentUser.organizationId,
      ticketId,
      attachmentId,
      allowedVisibilities: this.resolveAllowedVisibilities(currentUser),
    });

    if (!attachment) {
      throw new NotFoundException('Attachment no encontrado');
    }

    const stream = await this.storage.openReadStream(attachment.storageKey);
    return {
      stream,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    };
  }

  async remove(
    currentUser: RequestUser,
    ticketId: string,
    attachmentId: string,
  ): Promise<void> {
    if (currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Solo los administradores pueden eliminar attachments',
      );
    }

    await this.ticketsService.findOne(currentUser, ticketId);

    const deleted = await this.repository.softDelete({
      organizationId: currentUser.organizationId,
      ticketId,
      attachmentId,
      deletedById: currentUser.id,
    });

    if (!deleted) {
      throw new NotFoundException('Attachment no encontrado');
    }

    try {
      await this.storage.delete(deleted.storageKey);
    } catch (error: unknown) {
      // La metadata ya quedó oculta. El fallo físico se registra para cleanup,
      // pero nunca se revierte el soft-delete ni se reexpone el attachment.
      this.logger.error(
        `No se pudo eliminar físicamente el attachment ${attachmentId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private assertCanWrite(
    currentUser: RequestUser,
    ticket: TicketResponseDto | LockedAttachmentTicketRow,
  ): void {
    if (currentUser.role === UserRole.ADMIN) {
      return;
    }

    const createdById =
      'createdById' in ticket ? ticket.createdById : ticket.createdBy.id;
    const assignedToId =
      'assignedToId' in ticket
        ? ticket.assignedToId
        : (ticket.assignedTo?.id ?? null);

    if (currentUser.role === UserRole.USER) {
      if (createdById !== currentUser.id) {
        throw new ForbiddenException('No tienes acceso a este ticket');
      }
      return;
    }

    if (assignedToId !== currentUser.id) {
      throw new ForbiddenException(
        'Solo puedes adjuntar archivos a tickets asignados a ti',
      );
    }
  }

  private assertTicketIsWritable(status: TicketStatus): void {
    if (status === TicketStatus.CLOSED || status === TicketStatus.CANCELLED) {
      throw new ConflictException(
        'No se pueden agregar attachments a un ticket cerrado o cancelado',
      );
    }
  }

  private resolveEffectiveVisibility(
    currentUser: RequestUser,
    dto: UploadAttachmentDto,
    comment: AttachmentComment | null,
  ): CommentVisibility {
    let visibility: CommentVisibility;

    if (dto.commentId) {
      if (!comment) {
        throw new NotFoundException('Comentario no encontrado');
      }
      if (comment.authorId !== currentUser.id) {
        throw new ForbiddenException(
          'Solo el autor del comentario puede asociarle un attachment',
        );
      }
      if (dto.visibility && dto.visibility !== comment.visibility) {
        throw new BadRequestException(
          'La visibilidad debe coincidir con la del comentario',
        );
      }
      visibility = comment.visibility;
    } else {
      if (!dto.visibility) {
        throw new BadRequestException(
          'visibility es obligatoria para attachments generales del ticket',
        );
      }
      visibility = dto.visibility;
    }

    if (
      currentUser.role === UserRole.USER &&
      visibility !== CommentVisibility.PUBLIC
    ) {
      throw new ForbiddenException(
        'Los usuarios solo pueden crear attachments públicos',
      );
    }

    return visibility;
  }

  private resolveAllowedVisibilities(
    currentUser: RequestUser,
    requested?: CommentVisibility,
  ): CommentVisibility[] {
    if (currentUser.role === UserRole.USER) {
      return [CommentVisibility.PUBLIC];
    }

    return requested
      ? [requested]
      : [CommentVisibility.PUBLIC, CommentVisibility.INTERNAL];
  }

  private toResponseDto(attachment: AttachmentRecord): AttachmentResponseDto {
    return {
      id: attachment.id,
      ticketId: attachment.ticketId,
      commentId: attachment.commentId,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      visibility: attachment.visibility,
      uploadedBy: {
        id: attachment.uploadedBy.id,
        name: attachment.uploadedBy.fullName,
        role: attachment.uploadedBy.role,
      },
      createdAt: attachment.createdAt,
    };
  }
}
