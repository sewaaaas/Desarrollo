import { IsEnum } from 'class-validator';
import { UserStatus } from '@prisma/client';

/**
 * UpdateUserStatusDto
 *
 * Solo permite ACTIVE e INACTIVE.
 * El estado DELETED únicamente se establece via DELETE /users/:id (soft delete).
 */
export class UpdateUserStatusDto {
  @IsEnum([UserStatus.ACTIVE, UserStatus.INACTIVE], {
    message: 'El estado debe ser ACTIVE o INACTIVE',
  })
  status!: UserStatus;
}