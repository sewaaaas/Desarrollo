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
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserFiltersDto } from './dto/user-filters.dto';
import { UserResponseDto, PaginatedUsersDto } from './dto/user-response.dto';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  async create(
    @CurrentUser() currentUser: RequestUser,
    @Body() dto: CreateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.create(currentUser.organizationId, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  async findAll(
    @CurrentUser() currentUser: RequestUser,
    @Query() filters: UserFiltersDto,
  ): Promise<PaginatedUsersDto> {
    return this.usersService.findAll(currentUser.organizationId, filters);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  async findOne(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
  ): Promise<UserResponseDto> {
    return this.usersService.findOne(currentUser.organizationId, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(currentUser.organizationId, id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN)
  async remove(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.usersService.remove(currentUser.organizationId, id, currentUser);
  }
}