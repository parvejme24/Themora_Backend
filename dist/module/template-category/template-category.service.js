"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateCategoryService = void 0;
const database_1 = require("../../config/database");
class TemplateCategoryService {
    async createTemplateCategory(data) {
        try {
            const slug = data.slug || this.generateSlug(data.title);
            const isUnique = await this.isSlugUnique(slug);
            if (!isUnique) {
                throw new Error("Slug already exists");
            }
            const category = await database_1.prisma.templateCategory.create({
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
        }
        catch (error) {
            throw new Error(error.message || "Failed to create template category");
        }
    }
    async getAllTemplateCategories(page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc') {
        try {
            const skip = (page - 1) * limit;
            const where = {};
            if (search && search.trim()) {
                const searchTerm = search.trim();
                where.OR = [
                    { title: { contains: searchTerm, mode: "insensitive" } },
                    { slug: { contains: searchTerm, mode: "insensitive" } },
                ];
            }
            const [categories, total] = await Promise.all([
                database_1.prisma.templateCategory.findMany({
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
                        [sortBy]: sortOrder,
                    },
                }),
                database_1.prisma.templateCategory.count({ where }),
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
        }
        catch (error) {
            throw new Error("Failed to fetch template categories");
        }
    }
    async getTemplateCategoryById(id) {
        try {
            const category = await database_1.prisma.templateCategory.findUnique({
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
        }
        catch (error) {
            throw new Error("Failed to fetch template category");
        }
    }
    async updateTemplateCategory(id, data) {
        try {
            const existingCategory = await database_1.prisma.templateCategory.findUnique({
                where: { id },
            });
            if (!existingCategory) {
                return null;
            }
            let slug = data.slug;
            if (data.title && !data.slug) {
                slug = this.generateSlug(data.title);
            }
            if (slug && slug !== existingCategory.slug) {
                const isUnique = await this.isSlugUnique(slug, id);
                if (!isUnique) {
                    throw new Error("Slug already exists");
                }
            }
            const category = await database_1.prisma.templateCategory.update({
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
        }
        catch (error) {
            throw new Error(error.message || "Failed to update template category");
        }
    }
    async deleteTemplateCategory(id) {
        try {
            const category = await database_1.prisma.templateCategory.findUnique({
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
            if (category.templates.length > 0) {
                return {
                    success: false,
                    message: "Cannot delete category with existing templates",
                };
            }
            await database_1.prisma.templateCategory.delete({
                where: { id },
            });
            return {
                success: true,
                message: "Template category deleted successfully",
            };
        }
        catch (error) {
            throw new Error("Failed to delete template category");
        }
    }
    async getTemplateCategoryStats() {
        try {
            const [totalCategories, totalTemplates, categoriesWithTemplates] = await Promise.all([
                database_1.prisma.templateCategory.count(),
                database_1.prisma.template.count(),
                database_1.prisma.templateCategory.findMany({
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
        }
        catch (error) {
            throw new Error("Failed to fetch template category statistics");
        }
    }
    generateSlug(title) {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }
    async isSlugUnique(slug, excludeId) {
        try {
            const where = { slug };
            if (excludeId) {
                where.id = { not: excludeId };
            }
            const existing = await database_1.prisma.templateCategory.findFirst({
                where,
            });
            return !existing;
        }
        catch (error) {
            throw new Error("Failed to check slug uniqueness");
        }
    }
}
exports.TemplateCategoryService = TemplateCategoryService;
//# sourceMappingURL=template-category.service.js.map