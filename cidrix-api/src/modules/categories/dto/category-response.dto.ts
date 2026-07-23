export class CategoryResponseDto {
  id!: string;
  name!: string;
  slug!: string;
  description!: string | null;
  color!: string | null;
  isActive!: boolean;
  parentId!: string | null;
  organizationId!: string;
  createdAt!: Date;
  updatedAt!: Date;
}

export class PaginatedCategoriesDto {
  data!: CategoryResponseDto[];
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}