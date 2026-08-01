import { CommentVisibility, UserRole } from '@prisma/client';

export class CommentAuthorDto {
  id!: string;
  name!: string;
  role!: UserRole;
}

/**
 * CommentResponseDto
 *
 * Datos mínimos del autor (id, name, role) — nunca email, teléfono ni otro
 * dato de contacto, independientemente del rol de quien consulta.
 * Sin updatedAt/deletedAt: el comentario es inmutable (sin PATCH ni DELETE).
 */
export class CommentResponseDto {
  id!: string;
  ticketId!: string;
  content!: string;
  visibility!: CommentVisibility;
  createdAt!: Date;
  author!: CommentAuthorDto;
}

export class PaginatedCommentsDto {
  data!: CommentResponseDto[];
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
