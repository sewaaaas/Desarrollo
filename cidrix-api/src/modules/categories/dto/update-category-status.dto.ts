import { IsBoolean } from 'class-validator';

/**
 * UpdateCategoryStatusDto
 * Endpoint: PATCH /categories/:id/status
 * Permite activar o desactivar explícitamente — no toggle.
 */
export class UpdateCategoryStatusDto {
  @IsBoolean({ message: 'isActive debe ser un booleano' })
  isActive!: boolean;
}