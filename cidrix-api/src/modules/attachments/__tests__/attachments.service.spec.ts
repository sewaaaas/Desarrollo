/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CommentVisibility,
  Prisma,
  TicketPriority,
  TicketStatus,
  UserRole,
} from '@prisma/client';
import { Readable } from 'node:stream';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';
import { SortOrder } from '@modules/tickets/dto/ticket-filters.dto';
import { TicketResponseDto } from '@modules/tickets/dto/ticket-response.dto';
import { TicketsService } from '@modules/tickets/tickets.service';
import {
  AttachmentsRepository,
  LockedAttachmentTicketRow,
} from '../attachments.repository';
import { AttachmentsService } from '../attachments.service';
import { AttachmentStorage } from '../storage/attachment-storage.interface';
import {
  AttachmentFileValidator,
  UploadedAttachmentFile,
  ValidatedAttachmentFile,
} from '../validation/attachment-file.validator';

describe('AttachmentsService', () => {
  const ORG_A = 'org-a';
  const ORG_B = 'org-b';
  const TICKET_ID = 'ticket-1';
  const ATTACHMENT_ID = 'attachment-1';

  let service: AttachmentsService;
  let repository: jest.Mocked<AttachmentsRepository>;
  let ticketsService: jest.Mocked<TicketsService>;
  let fileValidator: jest.Mocked<AttachmentFileValidator>;
  let storage: jest.Mocked<AttachmentStorage>;

  const uploadedFile: UploadedAttachmentFile = {
    originalname: 'evidencia.txt',
    mimetype: 'text/plain',
    size: 4,
    buffer: Buffer.from('hola'),
  };

  const validatedFile: ValidatedAttachmentFile = {
    ...uploadedFile,
    normalizedName: 'evidencia.txt',
    extension: '.txt',
  };

  const lockedTicket: LockedAttachmentTicketRow = {
    id: TICKET_ID,
    organizationId: ORG_A,
    status: TicketStatus.OPEN,
    createdById: 'user-owner',
    assignedToId: 'tech-assigned',
  };

  const createdAttachment = {
    id: ATTACHMENT_ID,
    ticketId: TICKET_ID,
    commentId: null,
    originalName: 'evidencia.txt',
    mimeType: 'text/plain',
    sizeBytes: 4,
    visibility: CommentVisibility.PUBLIC,
    createdAt: new Date('2026-08-09T10:00:00.000Z'),
    uploadedBy: {
      id: 'user-owner',
      fullName: 'Usuario Owner',
      role: UserRole.USER,
    },
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

  function makeTicket(
    overrides: Partial<TicketResponseDto> = {},
  ): TicketResponseDto {
    return {
      id: TICKET_ID,
      ticketNumber: 'TKT-0001',
      title: 'Ticket',
      description: 'Descripción del ticket',
      status: TicketStatus.OPEN,
      priority: TicketPriority.MEDIUM,
      version: 1,
      createdBy: {
        id: 'user-owner',
        fullName: 'Usuario Owner',
        avatarUrl: null,
      },
      assignedTo: {
        id: 'tech-assigned',
        fullName: 'Técnico Asignado',
        avatarUrl: null,
      },
      category: null,
      firstResponseAt: null,
      resolvedAt: null,
      closedAt: null,
      createdAt: new Date('2026-08-09T09:00:00.000Z'),
      updatedAt: new Date('2026-08-09T09:00:00.000Z'),
      ...overrides,
    };
  }

  beforeEach(() => {
    repository = {
      runTransaction: jest.fn(),
      lockTicketForUpdate: jest.fn().mockResolvedValue(lockedTicket),
      findCommentForAttachment: jest.fn().mockResolvedValue(null),
      findCommentForTicket: jest.fn().mockResolvedValue(null),
      getActiveUsage: jest
        .fn()
        .mockResolvedValue({ count: 0, totalSizeBytes: 0 }),
      createAttachment: jest.fn().mockResolvedValue(createdAttachment),
      findManyForTicket: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      findForDownload: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<AttachmentsRepository>;
    repository.runTransaction.mockImplementation(
      async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) =>
        fn({} as Prisma.TransactionClient),
    );

    ticketsService = {
      findOne: jest.fn().mockResolvedValue(makeTicket()),
    } as unknown as jest.Mocked<TicketsService>;

    fileValidator = {
      validate: jest.fn().mockReturnValue(validatedFile),
    } as unknown as jest.Mocked<AttachmentFileValidator>;

    storage = {
      put: jest.fn().mockResolvedValue(undefined),
      openReadStream: jest.fn().mockResolvedValue(Readable.from('hola')),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const configService = new ConfigService({
      storage: {
        driver: 'local',
        localPath: './uploads',
        maxFileSizeBytes: 10_485_760,
        maxFilesPerTicket: 20,
        maxTotalSizePerTicketBytes: 104_857_600,
      },
    });

    service = new AttachmentsService(
      repository,
      ticketsService,
      fileValidator,
      storage,
      configService,
    );
  });

  it('USER sube un attachment PUBLIC a su propio ticket', async () => {
    const result = await service.upload(
      makeUser(),
      TICKET_ID,
      { visibility: CommentVisibility.PUBLIC },
      uploadedFile,
    );

    expect(result).toEqual({
      id: ATTACHMENT_ID,
      ticketId: TICKET_ID,
      commentId: null,
      originalName: 'evidencia.txt',
      mimeType: 'text/plain',
      sizeBytes: 4,
      visibility: CommentVisibility.PUBLIC,
      uploadedBy: {
        id: 'user-owner',
        name: 'Usuario Owner',
        role: UserRole.USER,
      },
      createdAt: createdAttachment.createdAt,
    });
    expect(storage.put).toHaveBeenCalledWith(
      expect.stringMatching(/^attachments\/[0-9a-f-]{36}$/),
      validatedFile.buffer,
    );
    expect(repository.createAttachment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId: ORG_A,
        ticketId: TICKET_ID,
        uploadedById: 'user-owner',
        visibility: CommentVisibility.PUBLIC,
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
  });

  it('USER no puede subir INTERNAL', async () => {
    await expect(
      service.upload(
        makeUser(),
        TICKET_ID,
        { visibility: CommentVisibility.INTERNAL },
        uploadedFile,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('TECHNICIAN asignado puede subir PUBLIC o INTERNAL', async () => {
    const technician = makeUser({
      id: 'tech-assigned',
      role: UserRole.TECHNICIAN,
    });
    ticketsService.findOne.mockResolvedValue(
      makeTicket({
        createdBy: makeTicket().createdBy,
        assignedTo: {
          id: 'tech-assigned',
          fullName: 'Técnico',
          avatarUrl: null,
        },
      }),
    );
    repository.lockTicketForUpdate.mockResolvedValue({
      ...lockedTicket,
      assignedToId: 'tech-assigned',
    });
    repository.createAttachment.mockResolvedValue({
      ...createdAttachment,
      visibility: CommentVisibility.INTERNAL,
      uploadedBy: {
        id: 'tech-assigned',
        fullName: 'Técnico',
        role: UserRole.TECHNICIAN,
      },
    });

    await expect(
      service.upload(
        technician,
        TICKET_ID,
        { visibility: CommentVisibility.INTERNAL },
        uploadedFile,
      ),
    ).resolves.toEqual(
      expect.objectContaining({ visibility: CommentVisibility.INTERNAL }),
    );
  });

  it('TECHNICIAN no asignado no puede subir aunque pueda leer el ticket', async () => {
    const technician = makeUser({
      id: 'tech-other',
      role: UserRole.TECHNICIAN,
    });

    await expect(
      service.upload(
        technician,
        TICKET_ID,
        { visibility: CommentVisibility.PUBLIC },
        uploadedFile,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(fileValidator.validate).not.toHaveBeenCalled();
  });

  it('ADMIN puede subir en cualquier ticket de su organización', async () => {
    const admin = makeUser({ id: 'admin-1', role: UserRole.ADMIN });

    await expect(
      service.upload(
        admin,
        TICKET_ID,
        { visibility: CommentVisibility.INTERNAL },
        uploadedFile,
      ),
    ).resolves.toBeDefined();
  });

  it.each([TicketStatus.CLOSED, TicketStatus.CANCELLED])(
    'rechaza upload en ticket %s con 409',
    async (status) => {
      ticketsService.findOne.mockResolvedValue(makeTicket({ status }));

      await expect(
        service.upload(
          makeUser({ role: UserRole.ADMIN }),
          TICKET_ID,
          { visibility: CommentVisibility.PUBLIC },
          uploadedFile,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(storage.put).not.toHaveBeenCalled();
    },
  );

  it('revalida CLOSED bajo lock y compensa el archivo ya escrito', async () => {
    repository.lockTicketForUpdate.mockResolvedValue({
      ...lockedTicket,
      status: TicketStatus.CLOSED,
    });

    await expect(
      service.upload(
        makeUser({ role: UserRole.ADMIN }),
        TICKET_ID,
        { visibility: CommentVisibility.PUBLIC },
        uploadedFile,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(storage.put).toHaveBeenCalledTimes(1);
    expect(storage.delete).toHaveBeenCalledTimes(1);
  });

  it('usa organizationId + ticketId al bloquear y crear metadata', async () => {
    await service.upload(
      makeUser(),
      TICKET_ID,
      { visibility: CommentVisibility.PUBLIC },
      uploadedFile,
    );

    expect(repository.lockTicketForUpdate).toHaveBeenCalledWith(
      expect.anything(),
      ORG_A,
      TICKET_ID,
    );
    expect(repository.getActiveUsage).toHaveBeenCalledWith(
      expect.anything(),
      ORG_A,
      TICKET_ID,
    );
  });

  it('no revela ni consulta un ticket de otra organización', async () => {
    ticketsService.findOne.mockRejectedValue(
      new NotFoundException('Ticket no encontrado'),
    );

    await expect(
      service.upload(
        makeUser({ organizationId: ORG_B }),
        TICKET_ID,
        { visibility: CommentVisibility.PUBLIC },
        uploadedFile,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findCommentForTicket).not.toHaveBeenCalled();
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('deriva visibilidad del comment del mismo tenant/ticket y exige autoría', async () => {
    const comment = {
      id: 'comment-1',
      authorId: 'tech-assigned',
      visibility: CommentVisibility.INTERNAL,
    };
    repository.findCommentForTicket.mockResolvedValue(comment);
    repository.findCommentForAttachment.mockResolvedValue(comment);
    repository.createAttachment.mockResolvedValue({
      ...createdAttachment,
      commentId: 'comment-1',
      visibility: CommentVisibility.INTERNAL,
    });
    const technician = makeUser({
      id: 'tech-assigned',
      role: UserRole.TECHNICIAN,
    });

    const result = await service.upload(
      technician,
      TICKET_ID,
      { commentId: 'comment-1' },
      uploadedFile,
    );

    expect(repository.findCommentForTicket).toHaveBeenCalledWith(
      ORG_A,
      TICKET_ID,
      'comment-1',
    );
    expect(result.visibility).toBe(CommentVisibility.INTERNAL);
  });

  it('rechaza comment inexistente o perteneciente a otro ticket/tenant', async () => {
    repository.findCommentForTicket.mockResolvedValue(null);

    await expect(
      service.upload(
        makeUser(),
        TICKET_ID,
        { commentId: 'comment-x' },
        uploadedFile,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('solo el autor puede asociar un archivo a un comment', async () => {
    repository.findCommentForTicket.mockResolvedValue({
      id: 'comment-1',
      authorId: 'user-other',
      visibility: CommentVisibility.PUBLIC,
    });

    await expect(
      service.upload(
        makeUser(),
        TICKET_ID,
        { commentId: 'comment-1' },
        uploadedFile,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza visibility incompatible con el comment', async () => {
    repository.findCommentForTicket.mockResolvedValue({
      id: 'comment-1',
      authorId: 'user-owner',
      visibility: CommentVisibility.PUBLIC,
    });

    await expect(
      service.upload(
        makeUser(),
        TICKET_ID,
        {
          commentId: 'comment-1',
          visibility: CommentVisibility.INTERNAL,
        },
        uploadedFile,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exige visibility para attachment general del ticket', async () => {
    await expect(
      service.upload(makeUser(), TICKET_ID, {}, uploadedFile),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('aplica cuota máxima de 20 activos bajo lock y compensa storage', async () => {
    repository.getActiveUsage.mockResolvedValue({
      count: 20,
      totalSizeBytes: 100,
    });

    await expect(
      service.upload(
        makeUser(),
        TICKET_ID,
        { visibility: CommentVisibility.PUBLIC },
        uploadedFile,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.createAttachment).not.toHaveBeenCalled();
    expect(storage.delete).toHaveBeenCalledTimes(1);
  });

  it('aplica cuota acumulada de 100 MiB bajo lock', async () => {
    repository.getActiveUsage.mockResolvedValue({
      count: 1,
      totalSizeBytes: 104_857_598,
    });

    await expect(
      service.upload(
        makeUser(),
        TICKET_ID,
        { visibility: CommentVisibility.PUBLIC },
        uploadedFile,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(storage.delete).toHaveBeenCalledTimes(1);
  });

  it('compensa el archivo si falla la creación de metadata', async () => {
    repository.createAttachment.mockRejectedValue(new Error('database failed'));

    await expect(
      service.upload(
        makeUser(),
        TICKET_ID,
        { visibility: CommentVisibility.PUBLIC },
        uploadedFile,
      ),
    ).rejects.toThrow('database failed');
    expect(storage.delete).toHaveBeenCalledTimes(1);
  });

  it('no abre transacción ni crea metadata si falla storage.put', async () => {
    storage.put.mockRejectedValue(new Error('disk failed'));

    await expect(
      service.upload(
        makeUser(),
        TICKET_ID,
        { visibility: CommentVisibility.PUBLIC },
        uploadedFile,
      ),
    ).rejects.toThrow('disk failed');
    expect(repository.runTransaction).not.toHaveBeenCalled();
    expect(repository.createAttachment).not.toHaveBeenCalled();
  });

  it('USER lista solo PUBLIC aunque solicite INTERNAL', async () => {
    repository.findManyForTicket.mockResolvedValue({
      items: [createdAttachment],
      total: 1,
    });

    const result = await service.findAll(makeUser(), TICKET_ID, {
      visibility: CommentVisibility.INTERNAL,
    });

    expect(repository.findManyForTicket).toHaveBeenCalledWith({
      organizationId: ORG_A,
      ticketId: TICKET_ID,
      commentId: undefined,
      allowedVisibilities: [CommentVisibility.PUBLIC],
      page: 1,
      limit: 20,
      order: SortOrder.ASC,
    });
    expect(result.meta).toEqual({
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  });

  it('TECHNICIAN lista PUBLIC + INTERNAL de cualquier ticket legible', async () => {
    const technician = makeUser({ role: UserRole.TECHNICIAN });
    await service.findAll(technician, TICKET_ID, {});

    expect(ticketsService.findOne).toHaveBeenCalledWith(technician, TICKET_ID);
    expect(repository.findManyForTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_A,
        ticketId: TICKET_ID,
        allowedVisibilities: [
          CommentVisibility.PUBLIC,
          CommentVisibility.INTERNAL,
        ],
      }),
    );
  });

  it('download de USER consulta por tenant/ticket/id y solo PUBLIC', async () => {
    repository.findForDownload.mockResolvedValue({
      storageKey: 'attachments/key',
      originalName: 'evidencia.txt',
      mimeType: 'text/plain',
      sizeBytes: 4,
    });

    const result = await service.download(makeUser(), TICKET_ID, ATTACHMENT_ID);

    expect(repository.findForDownload).toHaveBeenCalledWith({
      organizationId: ORG_A,
      ticketId: TICKET_ID,
      attachmentId: ATTACHMENT_ID,
      allowedVisibilities: [CommentVisibility.PUBLIC],
    });
    expect(storage.openReadStream).toHaveBeenCalledWith('attachments/key');
    expect(result).toEqual(
      expect.objectContaining({
        originalName: 'evidencia.txt',
        mimeType: 'text/plain',
        sizeBytes: 4,
      }),
    );
  });

  it('download no revela INTERNAL o attachment ajeno: retorna 404', async () => {
    repository.findForDownload.mockResolvedValue(null);

    await expect(
      service.download(makeUser(), TICKET_ID, ATTACHMENT_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.openReadStream).not.toHaveBeenCalled();
  });

  it('DELETE rechaza USER y TECHNICIAN incluso si son uploader', async () => {
    await expect(
      service.remove(makeUser(), TICKET_ID, ATTACHMENT_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.remove(
        makeUser({ role: UserRole.TECHNICIAN }),
        TICKET_ID,
        ATTACHMENT_ID,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.softDelete).not.toHaveBeenCalled();
  });

  it('ADMIN soft-delete permitido en CLOSED y luego borra físicamente', async () => {
    const admin = makeUser({ id: 'admin-1', role: UserRole.ADMIN });
    ticketsService.findOne.mockResolvedValue(
      makeTicket({ status: TicketStatus.CLOSED }),
    );
    repository.softDelete.mockResolvedValue({
      storageKey: 'attachments/key',
    });

    await service.remove(admin, TICKET_ID, ATTACHMENT_ID);

    expect(repository.softDelete).toHaveBeenCalledWith({
      organizationId: ORG_A,
      ticketId: TICKET_ID,
      attachmentId: ATTACHMENT_ID,
      deletedById: 'admin-1',
    });
    expect(storage.delete).toHaveBeenCalledWith('attachments/key');
  });

  it('fallo de borrado físico no revierte ni expone el soft-delete', async () => {
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    repository.softDelete.mockResolvedValue({
      storageKey: 'attachments/key',
    });
    storage.delete.mockRejectedValue(new Error('disk delete failed'));

    await expect(
      service.remove(
        makeUser({ role: UserRole.ADMIN }),
        TICKET_ID,
        ATTACHMENT_ID,
      ),
    ).resolves.toBeUndefined();
    expect(repository.softDelete).toHaveBeenCalledTimes(1);
    expect(loggerError).toHaveBeenCalledWith(
      `No se pudo eliminar físicamente el attachment ${ATTACHMENT_ID}`,
      expect.any(String),
    );
    loggerError.mockRestore();
  });

  it('DELETE devuelve 404 si el attachment no existe o ya está eliminado', async () => {
    repository.softDelete.mockResolvedValue(null);

    await expect(
      service.remove(
        makeUser({ role: UserRole.ADMIN }),
        TICKET_ID,
        ATTACHMENT_ID,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.delete).not.toHaveBeenCalled();
  });
});
