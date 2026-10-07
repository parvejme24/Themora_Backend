"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.templateService = exports.TemplateService = void 0;
const database_1 = require("../../config/database");
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
            database_1.prisma.template.findMany({
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
            database_1.prisma.template.count({ where }),
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
        const template = await database_1.prisma.template.findUnique({
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
        const template = await database_1.prisma.template.create({
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
        await database_1.prisma.templateCategory.update({
            where: { id: data.categoryId },
            data: { templateCount: { increment: 1 } },
        });
        return template;
    }
    async updateTemplate(id, data) {
        const existingTemplate = await database_1.prisma.template.findUnique({
            where: { id },
            select: { categoryId: true },
        });
        if (!existingTemplate) {
            return null;
        }
        const template = await database_1.prisma.template.update({
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
                database_1.prisma.templateCategory.update({
                    where: { id: existingTemplate.categoryId },
                    data: { templateCount: { decrement: 1 } },
                }),
                database_1.prisma.templateCategory.update({
                    where: { id: data.categoryId },
                    data: { templateCount: { increment: 1 } },
                }),
            ]);
        }
        return template;
    }
    async deleteTemplate(id) {
        const template = await database_1.prisma.template.findUnique({
            where: { id },
            select: { categoryId: true },
        });
        if (!template) {
            return { success: false, message: "Template not found" };
        }
        await database_1.prisma.template.delete({
            where: { id },
        });
        await database_1.prisma.templateCategory.update({
            where: { id: template.categoryId },
            data: { templateCount: { decrement: 1 } },
        });
        return { success: true, message: "Template deleted successfully" };
    }
    async getNewArrivals(limit = 20) {
        const templates = await database_1.prisma.template.findMany({
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
            database_1.prisma.template.count(),
            database_1.prisma.template.aggregate({
                _sum: { downloads: true },
            }),
            database_1.prisma.template.aggregate({
                _sum: { totalPurchase: true },
            }),
            database_1.prisma.template.aggregate({
                _avg: { price: true },
            }),
            database_1.prisma.templateCategory.findMany({
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
exports.templateService = new TemplateService();
//# sourceMappingURL=template.service.js.map