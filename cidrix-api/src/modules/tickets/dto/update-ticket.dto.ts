import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TicketPriority } from '@prisma/client';

export class UpdateTicketDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  description?: string;

  @IsOptional()
  @IsEnum(TicketPriority, { message: 'Prioridad inválida' })
  priority?: TicketPriority;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string | null;

  @IsInt()
  @Min(1)
  version!: number;
}