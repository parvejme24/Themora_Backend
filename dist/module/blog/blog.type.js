"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blogReactionSchema = exports.blogStatusSchema = exports.blogLikeSchema = exports.authorIdSchema = exports.categoryIdSchema = exports.blogIdSchema = exports.blogQuerySchema = exports.updateBlogSchema = exports.createBlogSchema = void 0;
const zod_1 = require("zod");
exports.createBlogSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
    categoryId: zod_1.z.string().uuid("Invalid category ID"),
    featuredImageUrl: zod_1.z.string().url("Invalid image URL").optional(),
    description: zod_1.z.string().min(1, "Description is required"),
    readingTime: zod_1.z.union([
        zod_1.z.number(),
        zod_1.z.string().regex(/^\d+(\.\d+)?$/, "Reading time must be a number string").transform(Number)
    ]).transform((v) => (typeof v === 'string' ? Number(v) : v)).pipe(zod_1.z.number().min(0).max(60)),
    authorId: zod_1.z.string().uuid("Invalid author ID").optional(),
    slug: zod_1.z.string().min(1, "Slug cannot be empty").max(200, "Slug must be less than 200 characters").optional(),
    isPublished: zod_1.z.union([
        zod_1.z.boolean(),
        zod_1.z.string().transform((val) => val === 'true')
    ]).optional().default(false),
    content: zod_1.z.any().optional(),
});
exports.updateBlogSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, "Title is required").max(200, "Title must be less than 200 characters").optional(),
    categoryId: zod_1.z.string().uuid("Invalid category ID").optional(),
    featuredImageUrl: zod_1.z.string().url("Invalid image URL").optional(),
    description: zod_1.z.string().min(1, "Description cannot be empty").optional(),
    readingTime: zod_1.z.union([
        zod_1.z.number(),
        zod_1.z.string().regex(/^\d+(\.\d+)?$/).transform(Number)
    ]).transform((v) => (typeof v === 'string' ? Number(v) : v)).pipe(zod_1.z.number().min(0).max(60)).optional(),
    slug: zod_1.z.string().min(1, "Slug cannot be empty").max(200, "Slug must be less than 200 characters").optional(),
    isPublished: zod_1.z.union([
        zod_1.z.boolean(),
        zod_1.z.string().transform((val) => val === 'true')
    ]).optional(),
    content: zod_1.z.any().optional(),
});
exports.blogQuerySchema = zod_1.z.object({
    page: zod_1.z.string().transform(Number).pipe(zod_1.z.number().min(1)).optional().default(1),
    limit: zod_1.z.string().transform(Number).pipe(zod_1.z.number().min(1).max(100)).optional().default(10),
    search: zod_1.z.string().optional(),
    categoryId: zod_1.z.string().uuid("Invalid category ID").optional(),
    authorId: zod_1.z.string().uuid("Invalid author ID").optional(),
    isPublished: zod_1.z.enum(["true", "false"]).transform((value) => value === "true").optional(),
    sortBy: zod_1.z.enum(['createdAt', 'updatedAt', 'reactCount', 'viewCount', 'readingTime']).optional().default('createdAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('desc'),
});
exports.blogIdSchema = zod_1.z.object({
    id: zod_1.z.string().uuid("Invalid blog ID"),
});
exports.categoryIdSchema = zod_1.z.object({
    categoryId: zod_1.z.string().uuid("Invalid category ID"),
});
exports.authorIdSchema = zod_1.z.object({
    authorId: zod_1.z.string().uuid("Invalid author ID"),
});
exports.blogLikeSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid("Invalid user ID").optional(),
});
exports.blogStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['draft', 'published']),
});
exports.blogReactionSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid("Invalid user ID").optional(),
    reactionType: zod_1.z.enum(['LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY']),
});
//# sourceMappingURL=blog.type.js.map