import { z } from "zod";
export declare const createBlogReviewSchema: z.ZodObject<{
    fullName: z.ZodString;
    email: z.ZodString;
    commentText: z.ZodString;
    userId: z.ZodOptional<z.ZodString>;
    rating: z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>]>, z.ZodTransform<number, number>>, z.ZodNumber>>;
    photoUrl: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const createBlogReviewReplySchema: z.ZodObject<{
    fullName: z.ZodString;
    email: z.ZodString;
    replyText: z.ZodString;
    userId: z.ZodOptional<z.ZodString>;
    photoUrl: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const blogReviewQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    blogId: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
    rating: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        createdAt: "createdAt";
        updatedAt: "updatedAt";
        rating: "rating";
    }>>>;
    sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>>;
}, z.core.$strip>;
export declare const blogReviewIdSchema: z.ZodObject<{
    reviewId: z.ZodString;
}, z.core.$strip>;
export declare const blogIdParamSchema: z.ZodObject<{
    blogId: z.ZodString;
}, z.core.$strip>;
export declare const blogReviewReplyIdSchema: z.ZodObject<{
    replyId: z.ZodString;
}, z.core.$strip>;
export declare const updateBlogReviewSchema: z.ZodObject<{
    rating: z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>]>, z.ZodTransform<number, number>>, z.ZodNumber>>;
    commentText: z.ZodOptional<z.ZodString>;
    fullName: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    photoUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export type CreateBlogReviewType = z.infer<typeof createBlogReviewSchema>;
export type CreateBlogReviewReplyType = z.infer<typeof createBlogReviewReplySchema>;
export type BlogReviewQueryType = z.infer<typeof blogReviewQuerySchema>;
export type BlogReviewIdType = z.infer<typeof blogReviewIdSchema>;
export type BlogIdParamType = z.infer<typeof blogIdParamSchema>;
export type BlogReviewReplyIdType = z.infer<typeof blogReviewReplyIdSchema>;
export type UpdateBlogReviewType = z.infer<typeof updateBlogReviewSchema>;
//# sourceMappingURL=blog-review.type.d.ts.map