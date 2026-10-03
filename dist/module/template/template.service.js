"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateService = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class TemplateService {
    async getAllTemplates(query) {
        const { page, limit, search, categoryId, sortBy, sortOrder, minPrice, maxPrice } = query;
        const skip = (page - 1) * limit;
        const where = {};
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
            if (minPrice !== undefined)
                where.price.gte = minPrice;
            if (maxPrice !== undefined)
                where.price.lte = maxPrice;
        }
        const orderBy = {};
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
            templates: templates,
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
    async getTemplateById(id) {
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
        return template;
    }
    async createTemplate(data) {
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
        await prisma.templateCategory.update({
            where: { id: data.categoryId },
            data: { templateCount: { increment: 1 } },
        });
        return template;
    }
    async updateTemplate(id, data) {
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
        return template;
    }
    async deleteTemplate(id) {
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
        await prisma.templateCategory.update({
            where: { id: template.categoryId },
            data: { templateCount: { decrement: 1 } },
        });
        return { success: true, message: "Template deleted successfully" };
    }
    async getNewArrivals(limit = 20) {
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
        return templates;
    }
    async getTemplateStats() {
        const [totalTemplates, totalDownloads, totalPurchases, averagePrice, categoryStats,] = await Promise.all([
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
exports.TemplateService = TemplateService;
//# sourceMappingURL=template.service.js.map