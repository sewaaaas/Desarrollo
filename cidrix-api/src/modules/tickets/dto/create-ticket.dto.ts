import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TicketPriority } from '@prisma/client';

export class CreateTicketDto {
  @IsString()
  @MinLength(1, { message: 'El título no puede estar vacío' })
  @MaxLength(255, { message: 'El título no puede superar 255 caracteres' })
  title!: string;

  @IsString()
  @MinLength(10, { message: 'La descripción debe tener al menos 10 caracteres' })
  description!: string;

  @IsOptional()
  @IsEnum(TicketPriority, { message: 'Prioridad inválida' })
  priority?: TicketPriority;

  @IsOptional()
  @IsUUID('4', { message: 'categoryId debe ser un UUID válido' })
  categoryId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'assignedToId debe ser un UUID válido' })
  assignedToId?: string;
}