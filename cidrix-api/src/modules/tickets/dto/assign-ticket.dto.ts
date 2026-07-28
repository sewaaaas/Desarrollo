import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class AssignTicketDto {
  @IsOptional()
  @IsUUID('4', { message: 'assignedToId debe ser un UUID válido' })
  assignedToId!: string | null;

  @IsInt()
  @Min(1)
  version!: number;
}