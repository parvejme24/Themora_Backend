"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateBlogReviewSchema = exports.blogReviewReplyIdSchema = exports.blogIdParamSchema = exports.blogReviewIdSchema = exports.blogReviewQuerySchema = exports.createBlogReviewReplySchema = exports.createBlogReviewSchema = void 0;
const zod_1 = require("zod");
exports.createBlogReviewSchema = zod_1.z.object({
    fullName: zod_1.z.string().max(100, "Full name must be less than 100 characters").optional(),
    name: zod_1.z.string().max(100).optional(),
    email: zod_1.z.string().email("Invalid email address").optional(),
    commentText: zod_1.z.string().max(1000, "Comment must be less than 1000 characters").optional(),
    comment: zod_1.z.string().max(1000).optional(),
    userId: zod_1.z.string().uuid("Invalid user ID").optional(),
    rating: zod_1.z
        .union([
        zod_1.z.number(),
        zod_1.z.string().regex(/^\d+$/, "Rating must be a number between 1-5").transform(Number),
    ])
        .transform((v) => (typeof v === 'string' ? Number(v) : v))
        .pipe(zod_1.z.number().min(1).max(5))
        .optional(),
    photoUrl: zod_1.z.string().url("Invalid photo URL").optional().nullable(),
}).refine((data) => (data.commentText && data.commentText.trim().length > 0) || (data.comment && data.comment.trim().length > 0), { message: "Comment text is required", path: ["commentText"] });
exports.createBlogReviewReplySchema = zod_1.z.object({
    fullName: zod_1.z.string().max(100, "Full name must be less than 100 characters").optional(),
    name: zod_1.z.string().max(100).optional(),
    email: zod_1.z.string().email("Invalid email address").optional(),
    replyText: zod_1.z.string().max(500, "Reply must be less than 500 characters").optional(),
    reply: zod_1.z.string().max(500).optional(),
    comment: zod_1.z.string().max(500).optional(),
    userId: zod_1.z.string().uuid("Invalid user ID").optional(),
    photoUrl: zod_1.z.string().url("Invalid photo URL").optional().nullable(),
}).refine((data) => (data.replyText && data.replyText.trim().length > 0) ||
    (data.reply && data.reply.trim().length > 0) ||
    (data.comment && data.comment.trim().length > 0), { message: "Reply text is required", path: ["replyText"] });
exports.blogReviewQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().min(1).optional().default(1),
    limit: zod_1.z.coerce.number().min(1).max(100).optional().default(10),
    blogId: zod_1.z.string().uuid("Invalid blog ID").optional(),
    userId: zod_1.z.string().uuid("Invalid user ID").optional(),
    rating: zod_1.z.coerce.number().min(1).max(5).optional(),
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