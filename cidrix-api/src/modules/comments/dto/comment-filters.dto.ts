import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CommentVisibility } from '@prisma/client';
import { SortOrder } from '@modules/tickets/dto/ticket-filters.dto';

/**
 * CommentFiltersDto
 *
 * `visibility` aquí es un filtro OPCIONAL adicional — nunca amplía lo que el
 * rol ya puede ver, solo restringe dentro de lo permitido (aplicado en
 * CommentsService, no en este DTO).
 *
 * Reutiliza SortOrder de @modules/tickets/dto/ticket-filters.dto para no
 * duplicar el mismo enum asc/desc dos veces en el proyecto.
 *
 * El ordenamiento real de la query siempre es por (createdAt, id) juntos
 * para garantizar estabilidad; `order` solo controla la dirección.
 */
export class CommentFiltersDto {
  @IsOptional()
  @IsEnum(CommentVisibility, { message: 'visibility debe ser PUBLIC o INTERNAL' })
  visibility?: CommentVisibility;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder = SortOrder.ASC;
}
