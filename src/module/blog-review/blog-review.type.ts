import { z } from "zod";

// Blog review creation schema
// Public review: only name, email, comment required; userId optional; rating optional
export const createBlogReviewSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(100, "Full name must be less than 100 characters"),
  email: z.string().email("Invalid email address"),
  commentText: z.string().min(1, "Comment is required").max(1000, "Comment must be less than 1000 characters"),
  userId: z.string().uuid("Invalid user ID").optional(),
  rating: z
    .union([
      z.number(),
      z.string().regex(/^\d+$/, "Rating must be a number between 1-5").transform(Number),
    ])
    .transform((v) => (typeof v === 'string' ? Number(v) : v))
    .pipe(z.number().min(1).max(5))
    .optional(),
  photoUrl: z.string().url("Invalid photo URL").optional(),
});

// Blog review reply creation schema
// Public reply: only name, email, replyText required; userId optional
export const createBlogReviewReplySchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(100, "Full name must be less than 100 characters"),
  email: z.string().email("Invalid email address"),
  replyText: z.string().min(1, "Reply is required").max(500, "Reply must be less than 500 characters"),
  userId: z.string().uuid("Invalid user ID").optional(),
  photoUrl: z.string().url("Invalid photo URL").optional(),
});

// Blog review query schema
export const blogReviewQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
  blogId: z.string().uuid("Invalid blog ID").optional(),
  userId: z.string().uuid("Invalid user ID").optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
  sortBy: z.enum(['createdAt', 'rating', 'updatedAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Blog review ID parameter schema
export const blogReviewIdSchema = z.object({
  reviewId: z.string().uuid("Invalid review ID"),
});

// Blog ID parameter schema
export const blogIdParamSchema = z.object({
  blogId: z.string().uuid("Invalid blog ID"),
});

// Blog review reply ID parameter schema
export const blogReviewReplyIdSchema = z.object({
  replyId: z.string().uuid("Invalid reply ID"),
});

// Blog review update schema
export const updateBlogReviewSchema = z.object({
  rating: z
    .union([
      z.number(),
      z.string().regex(/^\d+$/, "Rating must be a number between 1-5").transform(Number),
    ])
    .transform((v) => (typeof v === 'string' ? Number(v) : v))
    .pipe(z.number().min(1).max(5))
    .optional(),
  commentText: z.string().min(1, "Comment is required").max(1000, "Comment must be less than 1000 characters").optional(),
  fullName: z.string().min(1, "Full name is required").max(100, "Full name must be less than 100 characters").optional(),
  email: z.string().email("Invalid email address").optional(),
  photoUrl: z.string().url("Invalid photo URL").optional().nullable(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update",
});

// Review approval schema
// Approval schema removed to match Prisma model

// Type exports
export type CreateBlogReviewType = z.infer<typeof createBlogReviewSchema>;
export type CreateBlogReviewReplyType = z.infer<typeof createBlogReviewReplySchema>;
export type BlogReviewQueryType = z.infer<typeof blogReviewQuerySchema>;
export type BlogReviewIdType = z.infer<typeof blogReviewIdSchema>;
export type BlogIdParamType = z.infer<typeof blogIdParamSchema>;
export type BlogReviewReplyIdType = z.infer<typeof blogReviewReplyIdSchema>;
export type UpdateBlogReviewType = z.infer<typeof updateBlogReviewSchema>;