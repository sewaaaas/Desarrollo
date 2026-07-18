import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

/**
 * UpdateUserDto — solo campos de presentación.
 * Email, role y password tienen flujos dedicados (Fase 2 / sprint RBAC).
 */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'El nombre no puede superar 255 caracteres' })
  fullName?: string;

  @IsOptional()
  @IsUrl({}, { message: 'El avatar debe ser una URL válida' })
  avatarUrl?: string | null;
}