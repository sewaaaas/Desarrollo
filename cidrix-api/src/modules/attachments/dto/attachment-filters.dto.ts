import { CommentVisibility } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { SortOrder } from '@modules/tickets/dto/ticket-filters.dto';

export class AttachmentFiltersDto {
  @IsOptional()
  @IsUUID('4')
  commentId?: string;

  @IsOptional()
  @IsEnum(CommentVisibility)
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
