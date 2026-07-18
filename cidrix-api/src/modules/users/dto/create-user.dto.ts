import { IsEmail, IsEnum, IsOptional, IsString, IsUrl, MinLength, MaxLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @IsEmail({}, { message: 'El email no tiene un formato válido' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password!: string;

  @IsString()
  @MaxLength(255, { message: 'El nombre no puede superar 255 caracteres' })
  fullName!: string;

  @IsEnum(UserRole, { message: 'El rol debe ser ADMIN, TECHNICIAN o USER' })
  role!: UserRole;

  @IsOptional()
  @IsUrl({}, { message: 'El avatar debe ser una URL válida' })
  avatarUrl?: string;
}