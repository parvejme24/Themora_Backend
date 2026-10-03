"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blogCategoryService = exports.BlogCategoryService = void 0;
const database_1 = require("../../config/database");
class BlogCategoryService {
    generateSlug(title) {
        const slug = title
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        return slug || 'untitled-' + Date.now();
    }
    async getAllBlogCategories(page = 1, limit = 10, search) {
        const skip = (page - 1) * limit;
        const where = search
            ? {
                OR: [
                    { title: { contains: search, mode: "insensitive" } },
                    { slug: { contains: search, mode: "insensitive" } },
                ],
            }
            : {};
        const [total, items] = await Promise.all([
            database_1.prisma.blogCategory.count({ where }),
            database_1.prisma.blogCategory.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
        ]);
        const totalPages = Math.ceil(total / limit);
        return {
            items: items,
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
    async getBlogCategoryById(id) {
        const category = await database_1.prisma.blogCategory.findUnique({
            where: { id },
        });
        return category;
    }
    async createBlogCategory(data, imageUrl) {
        console.log("Service received data:", data);
        const payload = {
            title: data.title,
            slug: data.slug
        };
        if (imageUrl)
            payload.imageUrl = imageUrl;
        console.log("Service payload:", payload);
        const created = await database_1.prisma.blogCategory.create({ data: payload });
        return created;
    }
    async updateBlogCategory(id, data, imageUrl) {
        const payload = { ...data };
        if (data.title && (!data.slug || data.slug.trim() === '')) {
            payload.slug = this.generateSlug(data.title);
        }
        if (imageUrl)
            payload.imageUrl = imageUrl;
        const updated = await database_1.prisma.blogCategory.update({ where: { id }, data: payload });
        return updated;
    }
    async deleteBlogCategory(id) {
        await database_1.prisma.blogCategory.delete({ where: { id } });
    }
}
exports.BlogCategoryService = BlogCategoryService;
exports.blogCategoryService = new BlogCategoryService();
//# sourceMappingURL=blog-category.service.js.map