import { z } from "zod";
import { ReviewStatus } from "@prisma/client";

export const reviewIdParamSchema = z.object({ id: z.string().uuid("Invalid review ID") });

export const productParamSchema = z.object({ slug: z.string().min(1).max(120) });

export const reviewQuerySchema = z.object({
  sort: z.enum(["newest", "highest", "lowest"]).default("newest"),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const adminReviewQuerySchema = z.object({
  status: z.nativeEnum(ReviewStatus).optional(),
  productId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(10, "Review must be at least 10 characters").max(3000),
});

export const updateReviewSchema = createReviewSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, "Nothing to update");

export const reviewStatusSchema = z.object({ status: z.nativeEnum(ReviewStatus) });

export const replySchema = z.object({ body: z.string().trim().min(2).max(2000) });

export type ReviewQuery = z.infer<typeof reviewQuerySchema>;
export type AdminReviewQuery = z.infer<typeof adminReviewQuerySchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
