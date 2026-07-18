import { UserRole, UserStatus } from '@prisma/client';

/**
 * UserResponseDto
 *
 * Nunca incluye: passwordHash, refreshTokenHash, deletedAt.
 * Estos campos son internos y nunca deben exponerse en la API.
 */
export class UserResponseDto {
  id!: string;
  email!: string;
  fullName!: string;
  role!: UserRole;
  status!: UserStatus;
  avatarUrl!: string | null;
  organizationId!: string;
  lastLoginAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class PaginatedUsersDto {
  data!: UserResponseDto[];
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}