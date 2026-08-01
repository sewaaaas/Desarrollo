import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { CommentVisibility } from '@prisma/client';

/**
 * CreateCommentDto
 *
 * `visibility` es OBLIGATORIO y sin default: el cliente debe elegir
 * explícitamente PUBLIC o INTERNAL. La regla "USER solo puede enviar PUBLIC
 * (si no, 403)" vive en CommentsService — este DTO solo valida que el valor
 * pertenezca al enum.
 *
 * `content` se normaliza (\r\n -> \n, trim) antes de validar longitud.
 * No se elimina HTML ni se altera código/XML/logs pegados por el usuario —
 * se guarda como texto plano tal cual; el escape seguro es responsabilidad
 * del frontend al renderizar.
 */
export class CreateCommentDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim() : value,
  )
  @IsString()
  @MinLength(1, { message: 'El comentario no puede estar vacío' })
  @MaxLength(5000, { message: 'El comentario no puede superar 5000 caracteres' })
  content!: string;

  @IsEnum(CommentVisibility, { message: 'visibility debe ser PUBLIC o INTERNAL' })
  visibility!: CommentVisibility;
}
