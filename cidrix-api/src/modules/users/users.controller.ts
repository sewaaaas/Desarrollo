import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserFiltersDto } from './dto/user-filters.dto';
import { UserResponseDto, PaginatedUsersDto } from './dto/user-response.dto';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';

/**
 * UsersController
 *
 * Todos los endpoints requieren JWT válido.
 * El organizationId siempre se obtiene del token — nunca del cliente.
 *
 * Autorización por rol (RBAC) se implementará en sprint posterior.
 * Por ahora cualquier usuario autenticado puede acceder.
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ---------------------------------------------------------------------------
  // POST /users — Crear usuario
  // ---------------------------------------------------------------------------

  @Post()
  async create(
    @CurrentUser() currentUser: RequestUser,
    @Body() dto: CreateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.create(currentUser.organizationId, dto);
  }

  // ---------------------------------------------------------------------------
  // GET /users — Listar usuarios con filtros y paginación
  // ---------------------------------------------------------------------------

  @Get()
  async findAll(
    @CurrentUser() currentUser: RequestUser,
    @Query() filters: UserFiltersDto,
  ): Promise<PaginatedUsersDto> {
    return this.usersService.findAll(currentUser.organizationId, filters);
  }

  // ---------------------------------------------------------------------------
  // GET /users/:id — Obtener usuario por ID
  // ---------------------------------------------------------------------------

  @Get(':id')
  async findOne(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
  ): Promise<UserResponseDto> {
    return this.usersService.findOne(currentUser.organizationId, id);
  }

  // ---------------------------------------------------------------------------
  // PATCH /users/:id — Actualizar usuario
  // ---------------------------------------------------------------------------

  @Patch(':id')
  async update(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(currentUser.organizationId, id, dto);
  }

  // ---------------------------------------------------------------------------
  // PATCH /users/:id/status — Activar o desactivar usuario
  // ---------------------------------------------------------------------------

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateStatus(
      currentUser.organizationId,
      id,
      dto,
      currentUser,
    );
  }

  // ---------------------------------------------------------------------------
  // DELETE /users/:id — Soft delete
  // ---------------------------------------------------------------------------

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.usersService.remove(currentUser.organizationId, id, currentUser);
  }
}