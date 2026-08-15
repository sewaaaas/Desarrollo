import { CommentVisibility, UserRole } from '@prisma/client';

export class AttachmentUploaderDto {
  id!: string;
  name!: string;
  role!: UserRole;
}

export class AttachmentResponseDto {
  id!: string;
  ticketId!: string;
  commentId!: string | null;
  originalName!: string;
  mimeType!: string;
  sizeBytes!: number;
  visibility!: CommentVisibility;
  uploadedBy!: AttachmentUploaderDto;
  createdAt!: Date;
}

export class PaginatedAttachmentsDto {
  data!: AttachmentResponseDto[];
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
