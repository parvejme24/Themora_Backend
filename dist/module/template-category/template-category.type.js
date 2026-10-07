"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.templateCategoryQuerySchema = exports.templateCategoryIdSchema = exports.updateTemplateCategorySchema = exports.createTemplateCategorySchema = void 0;
const zod_1 = require("zod");
exports.createTemplateCategorySchema = zod_1.z.object({
    title: zod_1.z.string().min(1, "Title is required").max(100, "Title must not exceed 100 characters"),
    slug: zod_1.z.string().min(1, "Slug must not be empty").max(100, "Slug must not exceed 100 characters").optional(),
    image: zod_1.z.string().url("Invalid image URL").optional().or(zod_1.z.literal("")),
});
exports.updateTemplateCategorySchema = zod_1.z.object({
    title: zod_1.z.string().min(1, "Title is required").max(100, "Title must not exceed 100 characters").optional(),
    slug: zod_1.z.string().min(1, "Slug must not be empty").max(100, "Slug must not exceed 100 characters").optional(),
    image: zod_1.z.string().url("Invalid image URL").optional().or(zod_1.z.literal("")),
});
exports.templateCategoryIdSchema = zod_1.z.object({
    id: zod_1.z.string().uuid("Invalid template category ID format"),
});
exports.templateCategoryQuerySchema = zod_1.z.object({
    page: zod_1.z.string().optional().transform((val) => val ? parseInt(val, 10) : 1),
    limit: zod_1.z.string().optional().transform((val) => val ? parseInt(val, 10) : 10),
    search: zod_1.z.string().optional(),
    sortBy: zod_1.z.enum(['title', 'createdAt', 'updatedAt', 'templateCount']).optional().default('createdAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('desc'),
});
//# sourceMappingURL=template-category.type.js.map