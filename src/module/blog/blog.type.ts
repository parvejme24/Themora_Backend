import { z } from "zod";

// Blog creation schema
export const createBlogSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  categoryId: z.string().uuid("Invalid category ID"),
  featuredImageUrl: z.string().url("Invalid image URL").optional(),
  description: z.string().min(1, "Description is required"), // Text field for multiple paragraphs
  // Accept string or number; store as number
  readingTime: z.union([
    z.number(),
    z.string().regex(/^\d+(\.\d+)?$/, "Reading time must be a number string").transform(Number)
  ]).transform((v) => (typeof v === 'string' ? Number(v) : v)).pipe(z.number().min(0).max(60)),
  authorId: z.string().uuid("Invalid author ID").optional(),
  slug: z.string().min(1, "Slug cannot be empty").max(200, "Slug must be less than 200 characters").optional(),
  isPublished: z.union([
    z.boolean(),
    z.string().transform((val) => val === 'true')
  ]).optional().default(false), // Default to draft
  content: z.any().optional(), // JSON field for rich text editor
});

// Blog update schema
export const updateBlogSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be less than 200 characters").optional(),
  categoryId: z.string().uuid("Invalid category ID").optional(),
  featuredImageUrl: z.string().url("Invalid image URL").optional(),
  description: z.string().min(1, "Description cannot be empty").optional(), // Text field
  readingTime: z.union([
    z.number(),
    z.string().regex(/^\d+(\.\d+)?$/).transform(Number)
  ]).transform((v) => (typeof v === 'string' ? Number(v) : v)).pipe(z.number().min(0).max(60)).optional(),
  slug: z.string().min(1, "Slug cannot be empty").max(200, "Slug must be less than 200 characters").optional(),
  isPublished: z.union([
    z.boolean(),
    z.string().transform((val) => val === 'true')
  ]).optional(),
  content: z.any().optional(), // JSON field for rich text editor
});

// Blog query schema
export const blogQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).optional().default(1),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional().default(10),
  search: z.string().optional(),
  categoryId: z.string().uuid("Invalid category ID").optional(),
  authorId: z.string().uuid("Invalid author ID").optional(),
  isPublished: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'reactCount', 'viewCount', 'readingTime']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Blog ID parameter schema
export const blogIdSchema = z.object({
  id: z.string().uuid("Invalid blog ID"),
});

// Category ID parameter schema
export const categoryIdSchema = z.object({
  categoryId: z.string().uuid("Invalid category ID"),
});

// Author ID parameter schema
export const authorIdSchema = z.object({
  authorId: z.string().uuid("Invalid author ID"),
});

// Blog like schema
export const blogLikeSchema = z.object({
  userId: z.string().uuid("Invalid user ID").optional(),
});

// Blog status update schema
export const blogStatusSchema = z.object({
  status: z.enum(['draft', 'published']),
});

// Blog reaction schema
export const blogReactionSchema = z.object({
  userId: z.string().uuid("Invalid user ID").optional(),
  reactionType: z
    .string()
    .optional()
    .transform((val) => (val ? val.toUpperCase() : undefined)),
  reaction: z
    .string()
    .optional()
    .transform((val) => (val ? val.toUpperCase() : undefined)),
  type: z
    .string()
    .optional()
    .transform((val) => (val ? val.toUpperCase() : undefined)),
}).refine(
  (data) => {
    const r = data.reactionType || data.reaction || data.type;
    return r && ['LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY'].includes(r);
  },
  {
    message: "Valid reactionType is required: LIKE, LOVE, HAHA, WOW, SAD, or ANGRY",
    path: ["reactionType"],
  }
);

// Type exports
export type CreateBlogType = z.infer<typeof createBlogSchema>;
export type UpdateBlogType = z.infer<typeof updateBlogSchema>;
export type BlogQueryType = z.infer<typeof blogQuerySchema>;
export type BlogIdType = z.infer<typeof blogIdSchema>;
export type CategoryIdType = z.infer<typeof categoryIdSchema>;
export type AuthorIdType = z.infer<typeof authorIdSchema>;
export type BlogLikeType = z.infer<typeof blogLikeSchema>;
export type BlogStatusType = z.infer<typeof blogStatusSchema>;
export type BlogReactionType = z.infer<typeof blogReactionSchema>;
