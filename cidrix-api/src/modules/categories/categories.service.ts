import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateCategoryStatusDto } from './dto/update-category-status.dto';
import { CategoryFiltersDto } from './dto/category-filters.dto';
import { CategoryResponseDto, PaginatedCategoriesDto } from './dto/category-response.dto';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Crear categoría
  // ---------------------------------------------------------------------------

  async create(
    organizationId: string,
    dto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const slug = this.generateSlug(dto.name);

    // Verificar unicidad del slug en la organización
    const existing = await this.prisma.category.findUnique({
      where: { uq_categories_org_slug: { organizationId, slug } },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe una categoría con el slug "${slug}" en la organización. Usa un nombre diferente.`,
      );
    }

    // Validar parentId si se provee
    if (dto.parentId) {
      await this.validateParent(organizationId, dto.parentId);
    }

    const category = await this.prisma.category.create({
      data: {
        organizationId,
        name: dto.name,
        slug,
        description: dto.description ?? null,
        color: dto.color ?? null,
        parentId: dto.parentId ?? null,
        isActive: true,
      },
      select: this.safeSelect(),
    });

    this.logger.log(`Categoría creada: ${slug} (org: ${organizationId})`);

    return category;
  }

  // ---------------------------------------------------------------------------
  // Listar categorías
  // ---------------------------------------------------------------------------

  async findAll(
    organizationId: string,
    filters: CategoryFiltersDto,
  ): Promise<PaginatedCategoriesDto> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      organizationId,
      deletedAt: null, // Excluir soft deleted
    };

    // Por defecto solo activas — si se filtra explícitamente se respeta
    if (filters.isActive !== undefined) {
      where['isActive'] = filters.isActive;
    } else {
      where['isActive'] = true;
    }

    if (filters.search) {
      where['name'] = { contains: filters.search, mode: 'insensitive' };
    }

    const [categories, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        select: this.safeSelect(),
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.category.count({ where }),
    ]);

    return {
      data: categories,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Obtener categoría por ID
  // ---------------------------------------------------------------------------

  async findOne(
    organizationId: string,
    id: string,
  ): Promise<CategoryResponseDto> {
    const category = await this.prisma.category.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      select: this.safeSelect(),
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    return category;
  }

  // ---------------------------------------------------------------------------
  // Actualizar categoría
  // ---------------------------------------------------------------------------

  async update(
    organizationId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    await this.findOne(organizationId, id);

    const category = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.color !== undefined && { color: dto.color }),
      },
      select: this.safeSelect(),
    });

    this.logger.log(`Categoría actualizada: ${id} (org: ${organizationId})`);

    return category;
  }

  // ---------------------------------------------------------------------------
  // Actualizar status
  // ---------------------------------------------------------------------------

  async updateStatus(
    organizationId: string,
    id: string,
    dto: UpdateCategoryStatusDto,
  ): Promise<CategoryResponseDto> {
    await this.findOne(organizationId, id);

    const category = await this.prisma.category.update({
      where: { id },
      data: { isActive: dto.isActive },
      select: this.safeSelect(),
    });

    this.logger.log(
      `Status de categoría ${id} → ${dto.isActive ? 'ACTIVE' : 'INACTIVE'} (org: ${organizationId})`,
    );

    return category;
  }

  // ---------------------------------------------------------------------------
  // Soft delete
  // ---------------------------------------------------------------------------

  async remove(organizationId: string, id: string): Promise<void> {
    await this.findOne(organizationId, id);

    // Validar que no tenga hijos activos
    const childrenCount = await this.prisma.category.count({
      where: {
        parentId: id,
        deletedAt: null,
      },
    });

    if (childrenCount > 0) {
      throw new BadRequestException(
        'No puedes eliminar una categoría que tiene subcategorías activas. Elimínalas primero.',
      );
    }

    await this.prisma.category.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    this.logger.log(`Categoría eliminada (soft): ${id} (org: ${organizationId})`);
  }

  // ---------------------------------------------------------------------------
  // Helpers privados
  // ---------------------------------------------------------------------------

  /**
   * Genera slug URL-safe desde el nombre.
   * Estable — no cambia si el nombre cambia después de crear.
   * Si ya existe → 409 CONFLICT (sin sufijos automáticos).
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Elimina acentos
      .replace(/[^a-z0-9\s-]/g, '')    // Solo letras, números, espacios y guiones
      .trim()
      .replace(/\s+/g, '-')            // Espacios → guiones
      .replace(/-+/g, '-');            // Guiones consecutivos → uno solo
  }

  /**
   * Valida que el parentId exista, pertenezca a la organización
   * y no esté eliminado.
   */
  private async validateParent(
    organizationId: string,
    parentId: string,
  ): Promise<void> {
    const parent = await this.prisma.category.findFirst({
      where: {
        id: parentId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!parent) {
      throw new BadRequestException(
        'La categoría padre no existe o no pertenece a esta organización',
      );
    }
  }

  private safeSelect() {
    return {
      id: true,
      name: true,
      slug: true,
      description: true,
      color: true,
      isActive: true,
      parentId: true,
      organizationId: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }
}