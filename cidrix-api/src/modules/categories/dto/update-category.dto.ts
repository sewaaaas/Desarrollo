import { IsHexColor, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * UpdateCategoryDto — no incluye parentId.
 * La reasignación de jerarquía se implementa junto con la lógica de árbol.
 */
export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'El nombre no puede superar 100 caracteres' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsHexColor({ message: 'El color debe ser un valor hex válido, ej: #3B82F6' })
  color?: string | null;
}