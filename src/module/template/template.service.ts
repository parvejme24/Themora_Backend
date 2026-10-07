import { prisma } from "../../config/database";
import { ITemplateService } from "./template.interface";
import { CreateTemplateInput, UpdateTemplateInput, Template, PaginatedTemplates, TemplateStats, TemplateQuery } from "./template.type";

export class TemplateService implements ITemplateService {
  async getAllTemplates(query: TemplateQuery): Promise<PaginatedTemplates> {
    const { page, limit, search, categoryId, sortBy, sortOrder, minPrice, maxPrice } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { shortDescription: { contains: search, mode: 'insensitive' } },
        { description: { has: search } }
      ];
    }
    
    if (categoryId) {
      where.categoryId = categoryId;
    }
    
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    // Build orderBy clause
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [templates, total] = await Promise.all([
      prisma.template.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: {
            select: {
              id: true,
              title: true,
              slug: true,
              image: true,
            },
          },
          links: true,
        },
      }),
      prisma.template.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      templates: templates as unknown as Template[],
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getTemplateById(id: string): Promise<Template | null> {
    const template = await prisma.template.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            title: true,
            slug: true,
            image: true,
          },
        },
        links: true,
      },
    });

    return template as unknown as Template | null;
  }

  async createTemplate(data: CreateTemplateInput): Promise<Template> {
    const template = await prisma.template.create({
      data: {
        ...data,
        screenshots: data.screenshots || [],
        sourceFiles: data.sourceFiles || [],
        description: data.description || [],
        whatsIncluded: data.whatsIncluded || [],
        keyFeatures: data.keyFeatures || [],
        version: data.version || 1.0,
      },
      include: {
        category: {
          select: {
            id: true,
            title: true,
            slug: true,
            image: true,
          },
        },
        links: true,
      },
    });

    // Update category template count
    await prisma.templateCategory.update({
      where: { id: data.categoryId },
      data: { templateCount: { increment: 1 } },
    });

    return template as unknown as Template;
  }

  async updateTemplate(id: string, data: UpdateTemplateInput): Promise<Template | null> {
    const existingTemplate = await prisma.template.findUnique({
      where: { id },
      select: { categoryId: true },
    });

    if (!existingTemplate) {
      return null;
    }

    const template = await prisma.template.update({
      where: { id },
      data,
      include: {
        category: {
          select: {
            id: true,
            title: true,
            slug: true,
            image: true,
          },
        },
        links: true,
      },
    });

    // Update category template count if category changed
    if (data.categoryId && data.categoryId !== existingTemplate.categoryId) {
      await Promise.all([
        prisma.templateCategory.update({
          where: { id: existingTemplate.categoryId },
          data: { templateCount: { decrement: 1 } },
        }),
        prisma.templateCategory.update({
          where: { id: data.categoryId },
          data: { templateCount: { increment: 1 } },
        }),
      ]);
    }

    return template as unknown as Template;
  }

  async deleteTemplate(id: string): Promise<{ success: boolean; message: string }> {
    const template = await prisma.template.findUnique({
      where: { id },
      select: { categoryId: true },
    });

    if (!template) {
      return { success: false, message: "Template not found" };
    }

    await prisma.template.delete({
      where: { id },
    });

    // Update category template count
    await prisma.templateCategory.update({
      where: { id: template.categoryId },
      data: { templateCount: { decrement: 1 } },
    });

    return { success: true, message: "Template deleted successfully" };
  }

  async getNewArrivals(limit: number = 20): Promise<Template[]> {
    const templates = await prisma.template.findMany({
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        category: {
          select: {
            id: true,
            title: true,
            slug: true,
            image: true,
          },
        },
        links: true,
      },
    });

    return templates as unknown as Template[];
  }

  async getTemplateStats(): Promise<TemplateStats> {
    const [
      totalTemplates,
      totalDownloads,
      totalPurchases,
      averagePrice,
      categoryStats,
    ] = await Promise.all([
      prisma.template.count(),
      prisma.template.aggregate({
        _sum: { downloads: true },
      }),
      prisma.template.aggregate({
        _sum: { totalPurchase: true },
      }),
      prisma.template.aggregate({
        _avg: { price: true },
      }),
      prisma.templateCategory.findMany({
        select: {
          id: true,
          title: true,
          templateCount: true,
          templates: {
            select: {
              downloads: true,
              totalPurchase: true,
            },
          },
        },
      }),
    ]);

    const categoryStatsFormatted = categoryStats.map((category) => ({
      categoryId: category.id,
      categoryName: category.title,
      templateCount: category.templateCount,
      totalDownloads: category.templates.reduce((sum, template) => sum + template.downloads, 0),
      totalPurchases: category.templates.reduce((sum, template) => sum + template.totalPurchase, 0),
    }));

    return {
      totalTemplates,
      totalDownloads: totalDownloads._sum.downloads || 0,
      totalPurchases: totalPurchases._sum.totalPurchase || 0,
      averagePrice: averagePrice._avg.price || 0,
      categoryStats: categoryStatsFormatted,
    };
  }
}

export const templateService = new TemplateService();
