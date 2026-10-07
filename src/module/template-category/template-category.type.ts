import { z } from "zod";

// Template category creation schema
export const createTemplateCategorySchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title must not exceed 100 characters"),
  slug: z.string().min(1, "Slug must not be empty").max(100, "Slug must not exceed 100 characters").optional(),
  image: z.string().url("Invalid image URL").optional().or(z.literal("")),
});

// Template category update schema
export const updateTemplateCategorySchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title must not exceed 100 characters").optional(),
  slug: z.string().min(1, "Slug must not be empty").max(100, "Slug must not exceed 100 characters").optional(),
  image: z.string().url("Invalid image URL").optional().or(z.literal("")),
});

// Template category ID parameter schema
export const templateCategoryIdSchema = z.object({
  id: z.string().uuid("Invalid template category ID format"),
});

// Template category query parameters schema
export const templateCategoryQuerySchema = z.object({
  page: z.string().optional().transform((val) => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform((val) => val ? parseInt(val, 10) : 10),
  search: z.string().optional(),
  sortBy: z.enum(['title', 'createdAt', 'updatedAt', 'templateCount']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Types
export type CreateTemplateCategoryInput = z.infer<typeof createTemplateCategorySchema>;
export type UpdateTemplateCategoryInput = z.infer<typeof updateTemplateCategorySchema>;
export type TemplateCategoryIdParams = z.infer<typeof templateCategoryIdSchema>;
export type TemplateCategoryQueryParams = z.infer<typeof templateCategoryQuerySchema>;

// Template category response types
export interface TemplateCategory {
  id: string;
  title: string;
  slug: string | null;
  image: string | null;
  templateCount: number;
  createdAt: Date;
  updatedAt: Date;
  templates?: Template[];
}

export interface Template {
  id: string;
  title: string;
  price: number;
  imageUrl: string | null;
  shortDescription: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedTemplateCategories {
  categories: TemplateCategory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface TemplateCategoryStats {
  totalCategories: number;
  totalTemplates: number;
  averageTemplatesPerCategory: number;
  mostPopularCategory: TemplateCategory | null;
}
