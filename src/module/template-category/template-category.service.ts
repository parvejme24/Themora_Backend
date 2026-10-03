import { prisma } from "../../config/database";
import { ITemplateCategoryService } from "./template-category.interface";
import { 
  TemplateCategory, 
  CreateTemplateCategoryInput, 
  UpdateTemplateCategoryInput, 
  PaginatedTemplateCategories,
  TemplateCategoryStats 
} from "./template-category.type";

export class TemplateCategoryService implements ITemplateCategoryService {
  // Create template category
  async createTemplateCategory(data: CreateTemplateCategoryInput): Promise<TemplateCategory> {
    try {
      // Generate slug if not provided
      const slug = data.slug || this.generateSlug(data.title);
      
      // Check if slug is unique
      const isUnique = await this.isSlugUnique(slug);
      if (!isUnique) {
        throw new Error("Slug already exists");
      }

      const category = await prisma.templateCategory.create({
        data: {
          title: data.title,
          slug,
          image: data.image,
        },
        include: {
          templates: {
            select: {
              id: true,
              title: true,
              price: true,
              imageUrl: true,
              shortDescription: true,
              version: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      return category;
    } catch (error: any) {
      throw new Error(error.message || "Failed to create template category");
    }
  }

  // Get all template categories with pagination and filtering
  async getAllTemplateCategories(
    page: number = 1,
    limit: number = 10,
    search?: string,
    sortBy: string = 'createdAt',
    sortOrder: string = 'desc'
  ): Promise<PaginatedTemplateCategories> {
    try {
      const skip = (page - 1) * limit;
      
      const where: any = {};
      
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" as any } },
          { slug: { contains: search, mode: "insensitive" as any } },
        ];
      }

      const [categories, total] = await Promise.all([
        prisma.templateCategory.findMany({
          where,
          skip,
          take: limit,
          include: {
            templates: {
              select: {
                id: true,
                title: true,
                price: true,
                imageUrl: true,
                shortDescription: true,
                version: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
          orderBy: {
            [sortBy]: sortOrder as any,
          },
        }),
        prisma.templateCategory.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        categories,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error: any) {
      throw new Error("Failed to fetch template categories");
    }
  }

  // Get template category by ID
  async getTemplateCategoryById(id: string): Promise<TemplateCategory | null> {
    try {
      const category = await prisma.templateCategory.findUnique({
        where: { id },
        include: {
          templates: {
            select: {
              id: true,
              title: true,
              price: true,
              imageUrl: true,
              shortDescription: true,
              version: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      return category;
    } catch (error: any) {
      throw new Error("Failed to fetch template category");
    }
  }

  // Update template category
  async updateTemplateCategory(id: string, data: UpdateTemplateCategoryInput): Promise<TemplateCategory | null> {
    try {
      // Check if category exists
      const existingCategory = await prisma.templateCategory.findUnique({
        where: { id },
      });

      if (!existingCategory) {
        return null;
      }

      // Generate slug if title is being updated and slug is not provided
      let slug = data.slug;
      if (data.title && !data.slug) {
        slug = this.generateSlug(data.title);
      }

      // Check if new slug is unique (excluding current category)
      if (slug && slug !== existingCategory.slug) {
        const isUnique = await this.isSlugUnique(slug, id);
        if (!isUnique) {
          throw new Error("Slug already exists");
        }
      }

      const category = await prisma.templateCategory.update({
        where: { id },
        data: {
          ...data,
          ...(slug && { slug }),
        },
        include: {
          templates: {
            select: {
              id: true,
              title: true,
              price: true,
              imageUrl: true,
              shortDescription: true,
              version: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      return category;
    } catch (error: any) {
      throw new Error(error.message || "Failed to update template category");
    }
  }

  // Delete template category
  async deleteTemplateCategory(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const category = await prisma.templateCategory.findUnique({
        where: { id },
        include: {
          templates: true,
        },
      });

      if (!category) {
        return {
          success: false,
          message: "Template category not found",
        };
      }

      // Check if category has templates
      if (category.templates.length > 0) {
        return {
          success: false,
          message: "Cannot delete category with existing templates",
        };
      }

      await prisma.templateCategory.delete({
        where: { id },
      });

      return {
        success: true,
        message: "Template category deleted successfully",
      };
    } catch (error: any) {
      throw new Error("Failed to delete template category");
    }
  }

  // Get template category statistics
  async getTemplateCategoryStats(): Promise<TemplateCategoryStats> {
    try {
      const [totalCategories, totalTemplates, categoriesWithTemplates] = await Promise.all([
        prisma.templateCategory.count(),
        prisma.template.count(),
        prisma.templateCategory.findMany({
          include: {
            _count: {
              select: {
                templates: true,
              },
            },
          },
          orderBy: {
            templateCount: 'desc',
          },
        }),
      ]);

      const averageTemplatesPerCategory = totalCategories > 0 ? totalTemplates / totalCategories : 0;
      const mostPopularCategory = categoriesWithTemplates[0] || null;

      return {
        totalCategories,
        totalTemplates,
        averageTemplatesPerCategory: Math.round(averageTemplatesPerCategory * 100) / 100,
        mostPopularCategory,
      };
    } catch (error: any) {
      throw new Error("Failed to fetch template category statistics");
    }
  }

  // Generate slug from title
  generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  // Check if slug is unique
  async isSlugUnique(slug: string, excludeId?: string): Promise<boolean> {
    try {
      const where: any = { slug };
      if (excludeId) {
        where.id = { not: excludeId };
      }

      const existing = await prisma.templateCategory.findFirst({
        where,
      });

      return !existing;
    } catch (error: any) {
      throw new Error("Failed to check slug uniqueness");
    }
  }
}
