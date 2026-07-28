import { IsEnum, IsInt, Min } from 'class-validator';
import { TicketStatus } from '@prisma/client';

export class UpdateTicketStatusDto {
  @IsEnum(TicketStatus, { message: 'Estado inválido' })
  status!: TicketStatus;

  @IsInt()
  @Min(1)
  version!: number;
}