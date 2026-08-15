import { CommentVisibility } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class UploadAttachmentDto {
  @IsOptional()
  @IsUUID('4', { message: 'commentId debe ser un UUID válido' })
  commentId?: string;

  @IsOptional()
  @IsEnum(CommentVisibility, {
    message: 'visibility debe ser PUBLIC o INTERNAL',
  })
  visibility?: CommentVisibility;
}
