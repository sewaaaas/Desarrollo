import 'reflect-metadata';
import { CommentVisibility } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SortOrder } from '@modules/tickets/dto/ticket-filters.dto';
import { AttachmentFiltersDto } from '../dto/attachment-filters.dto';
import { UploadAttachmentDto } from '../dto/upload-attachment.dto';

describe('Attachment DTOs', () => {
  it('AttachmentFiltersDto usa defaults y transforma números', async () => {
    const dto = plainToInstance(AttachmentFiltersDto, {
      page: '2',
      limit: '50',
      order: SortOrder.DESC,
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
    expect(dto.order).toBe(SortOrder.DESC);
  });

  it('AttachmentFiltersDto rechaza paginación, UUID y visibilidad inválidos', async () => {
    const dto = plainToInstance(AttachmentFiltersDto, {
      page: '0',
      limit: '101',
      order: 'sideways',
      commentId: 'not-a-uuid',
      visibility: 'SECRET',
    });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property).sort()).toEqual([
      'commentId',
      'limit',
      'order',
      'page',
      'visibility',
    ]);
  });

  it('UploadAttachmentDto acepta commentId y CommentVisibility válidos', async () => {
    const dto = plainToInstance(UploadAttachmentDto, {
      commentId: '1c722dbf-2fd9-4e7d-9781-50fe6a003b91',
      visibility: CommentVisibility.PUBLIC,
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('UploadAttachmentDto rechaza commentId y visibility inválidos', async () => {
    const dto = plainToInstance(UploadAttachmentDto, {
      commentId: 'comment-1',
      visibility: 'SECRET',
    });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property).sort()).toEqual([
      'commentId',
      'visibility',
    ]);
  });
});
