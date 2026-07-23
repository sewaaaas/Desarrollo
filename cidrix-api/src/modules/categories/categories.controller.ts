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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateCategoryStatusDto } from './dto/update-category-status.dto';
import { CategoryFiltersDto } from './dto/category-filters.dto';
import { CategoryResponseDto, PaginatedCategoriesDto } from './dto/category-response.dto';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  async create(
    @CurrentUser() currentUser: RequestUser,
    @Body() dto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.create(currentUser.organizationId, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TECHNICIAN)
  async findAll(
    @CurrentUser() currentUser: RequestUser,
    @Query() filters: CategoryFiltersDto,
  ): Promise<PaginatedCategoriesDto> {
    return this.categoriesService.findAll(currentUser.organizationId, filters);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TECHNICIAN)
  async findOne(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.findOne(currentUser.organizationId, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.update(currentUser.organizationId, id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  async updateStatus(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryStatusDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.updateStatus(
      currentUser.organizationId,
      id,
      dto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN)
  async remove(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.categoriesService.remove(currentUser.organizationId, id);
  }
}