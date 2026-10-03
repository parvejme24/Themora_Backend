"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateBlogReviewSchema = exports.blogReviewReplyIdSchema = exports.blogIdParamSchema = exports.blogReviewIdSchema = exports.blogReviewQuerySchema = exports.createBlogReviewReplySchema = exports.createBlogReviewSchema = void 0;
const zod_1 = require("zod");
exports.createBlogReviewSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(1, "Full name is required").max(100, "Full name must be less than 100 characters"),
    email: zod_1.z.string().email("Invalid email address"),
    commentText: zod_1.z.string().min(1, "Comment is required").max(1000, "Comment must be less than 1000 characters"),
    userId: zod_1.z.string().uuid("Invalid user ID").optional(),
    rating: zod_1.z
        .union([
        zod_1.z.number(),
        zod_1.z.string().regex(/^\d+$/, "Rating must be a number between 1-5").transform(Number),
    ])
        .transform((v) => (typeof v === 'string' ? Number(v) : v))
        .pipe(zod_1.z.number().min(1).max(5))
        .optional(),
    photoUrl: zod_1.z.string().url("Invalid photo URL").optional(),
});
exports.createBlogReviewReplySchema = zod_1.z.object({
    fullName: zod_1.z.string().min(1, "Full name is required").max(100, "Full name must be less than 100 characters"),
    email: zod_1.z.string().email("Invalid email address"),
    replyText: zod_1.z.string().min(1, "Reply is required").max(500, "Reply must be less than 500 characters"),
    userId: zod_1.z.string().uuid("Invalid user ID").optional(),
    photoUrl: zod_1.z.string().url("Invalid photo URL").optional(),
});
exports.blogReviewQuerySchema = zod_1.z.object({
    page: zod_1.z.string().transform(Number).pipe(zod_1.z.number().min(1)).optional().default(1),
    limit: zod_1.z.string().transform(Number).pipe(zod_1.z.number().min(1).max(100)).optional().default(10),
    blogId: zod_1.z.string().uuid("Invalid blog ID").optional(),
    userId: zod_1.z.string().uuid("Invalid user ID").optional(),
    rating: zod_1.z.string().transform(Number).pipe(zod_1.z.number().min(1).max(5)).optional(),
    sortBy: zod_1.z.enum(['createdAt', 'rating', 'updatedAt']).optional().default('createdAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('desc'),
});
exports.blogReviewIdSchema = zod_1.z.object({
    reviewId: zod_1.z.string().uuid("Invalid review ID"),
});
exports.blogIdParamSchema = zod_1.z.object({
    blogId: zod_1.z.string().uuid("Invalid blog ID"),
});
exports.blogReviewReplyIdSchema = zod_1.z.object({
    replyId: zod_1.z.string().uuid("Invalid reply ID"),
});
exports.updateBlogReviewSchema = zod_1.z.object({
    rating: zod_1.z
        .union([
        zod_1.z.number(),
        zod_1.z.string().regex(/^\d+$/, "Rating must be a number between 1-5").transform(Number),
    ])
        .transform((v) => (typeof v === 'string' ? Number(v) : v))
        .pipe(zod_1.z.number().min(1).max(5))
        .optional(),
    commentText: zod_1.z.string().min(1, "Comment is required").max(1000, "Comment must be less than 1000 characters").optional(),
    fullName: zod_1.z.string().min(1, "Full name is required").max(100, "Full name must be less than 100 characters").optional(),
    email: zod_1.z.string().email("Invalid email address").optional(),
    photoUrl: zod_1.z.string().url("Invalid photo URL").optional().nullable(),
}).refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
});
//# sourceMappingURL=blog-review.type.js.map