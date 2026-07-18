import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '@config/app.config';
import { UserStatus, UserRole } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserFiltersDto } from './dto/user-filters.dto';
import { UserResponseDto, PaginatedUsersDto } from './dto/user-response.dto';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';

/**
 * UsersService
 *
 * Gestiona el ciclo de vida de usuarios dentro de una organización.
 * El organizationId siempre viene del JWT (@CurrentUser) — nunca del cliente.
 *
 * Validaciones de negocio implementadas:
 *  - Email único por organización
 *  - No eliminar/desactivar al último ADMIN activo
 *  - No eliminar/desactivar el propio usuario
 *  - Estado DELETED solo via soft delete (DELETE /users/:id)
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // Crear usuario
  // ---------------------------------------------------------------------------

  async create(
    organizationId: string,
    dto: CreateUserDto,
  ): Promise<UserResponseDto> {
    const email = dto.email.toLowerCase();

    // Verificar unicidad de email dentro de la organización
    const existing = await this.prisma.user.findUnique({
      where: {
        uq_users_org_email: { organizationId, email },
      },
    });

    if (existing) {
      throw new ConflictException(
        'Ya existe un usuario con ese email en la organización',
      );
    }

    const saltRounds =
      this.configService.get<AppConfig>('app')?.bcryptSaltRounds ?? 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        organizationId,
        email,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
        avatarUrl: dto.avatarUrl ?? null,
        status: UserStatus.ACTIVE,
      },
      select: this.safeSelect(),
    });

    this.logger.log(`Usuario creado: ${email} (org: ${organizationId})`);

    return user;
  }

  // ---------------------------------------------------------------------------
  // Listar usuarios con filtros y paginación
  // ---------------------------------------------------------------------------

  async findAll(
    organizationId: string,
    filters: UserFiltersDto,
  ): Promise<PaginatedUsersDto> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause(organizationId, filters);

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: this.safeSelect(),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Obtener usuario por ID
  // ---------------------------------------------------------------------------

  async findOne(
    organizationId: string,
    id: string,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        organizationId,
        status: { not: UserStatus.DELETED },
      },
      select: this.safeSelect(),
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  // ---------------------------------------------------------------------------
  // Actualizar usuario
  // ---------------------------------------------------------------------------

  async update(
    organizationId: string,
    id: string,
    dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    await this.findOne(organizationId, id);

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
      select: this.safeSelect(),
    });

    this.logger.log(`Usuario actualizado: ${id} (org: ${organizationId})`);

    return user;
  }

  // ---------------------------------------------------------------------------
  // Actualizar status (ACTIVE | INACTIVE)
  // ---------------------------------------------------------------------------

  async updateStatus(
    organizationId: string,
    id: string,
    dto: UpdateUserStatusDto,
    currentUser: RequestUser,
  ): Promise<UserResponseDto> {
    // Validación: no puede cambiar su propio status
    if (currentUser.id === id) {
      throw new BadRequestException(
        'No puedes cambiar el estado de tu propio usuario',
      );
    }

    const user = await this.findOne(organizationId, id);

    // Validación: no desactivar al último ADMIN activo
    if (
      user.role === UserRole.ADMIN &&
      dto.status === UserStatus.INACTIVE
    ) {
      await this.validateNotLastAdmin(organizationId, id);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
      select: this.safeSelect(),
    });

    this.logger.log(
      `Status de usuario ${id} cambiado a ${dto.status} (org: ${organizationId})`,
    );

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Soft delete
  // ---------------------------------------------------------------------------

  async remove(
    organizationId: string,
    id: string,
    currentUser: RequestUser,
  ): Promise<void> {
    // Validación: no puede eliminarse a sí mismo
    if (currentUser.id === id) {
      throw new BadRequestException('No puedes eliminar tu propio usuario');
    }

    const user = await this.findOne(organizationId, id);

    // Validación: no eliminar al último ADMIN activo
    if (user.role === UserRole.ADMIN) {
      await this.validateNotLastAdmin(organizationId, id);
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.DELETED,
        deletedAt: new Date(),
        refreshTokenHash: null, // Invalida sesión activa
      },
    });

    this.logger.log(`Usuario eliminado (soft): ${id} (org: ${organizationId})`);
  }

  // ---------------------------------------------------------------------------
  // Helpers privados
  // ---------------------------------------------------------------------------

private buildWhereClause(
  organizationId: string,
  filters: UserFiltersDto,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    organizationId,
    status: { not: UserStatus.DELETED },
  };

  if (filters.status !== undefined) {
    where['status'] = filters.status;
  }

  if (filters.role !== undefined) {
    where['role'] = filters.role;
  }

  if (filters.search) {
    where['OR'] = [
      { fullName: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

  /**
   * Verifica que la organización tenga al menos otro ADMIN activo
   * antes de desactivar o eliminar al ADMIN con el id indicado.
   */
  private async validateNotLastAdmin(
    organizationId: string,
    excludeId: string,
  ): Promise<void> {
    const activeAdminsCount = await this.prisma.user.count({
      where: {
        organizationId,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        id: { not: excludeId },
      },
    });

    if (activeAdminsCount === 0) {
      throw new BadRequestException(
        'No puedes eliminar o desactivar al único administrador de la organización',
      );
    }
  }

  /**
   * Campos seguros para retornar en todas las queries.
   * Excluye explícitamente: passwordHash, refreshTokenHash, deletedAt.
   */
  private safeSelect() {
    return {
      id: true,
      email: true,
      fullName: true,
      role: true,
      status: true,
      avatarUrl: true,
      organizationId: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }
}