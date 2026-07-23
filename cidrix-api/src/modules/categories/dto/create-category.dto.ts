import {
  IsHexColor,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(1, { message: 'El nombre no puede estar vacío' })
  @MaxLength(100, { message: 'El nombre no puede superar 100 caracteres' })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La descripción no puede superar 500 caracteres' })
  description?: string;

  @IsOptional()
  @IsHexColor({ message: 'El color debe ser un valor hex válido, ej: #3B82F6' })
  color?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El parentId debe ser un UUID válido' })
  parentId?: string;
}