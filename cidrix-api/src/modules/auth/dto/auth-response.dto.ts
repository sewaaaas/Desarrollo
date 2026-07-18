import { UserRole } from '@prisma/client';

export class AuthResponseDto {
  accessToken!: string;
}

export class UserProfileDto {
  id!: string;
  email!: string;
  fullName!: string;
  role!: UserRole;
  organizationId!: string;
  avatarUrl!: string | null;
}