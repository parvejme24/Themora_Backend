import { z } from "zod";
export declare const createBlogSchema: z.ZodObject<{
    title: z.ZodString;
    categoryId: z.ZodString;
    featuredImageUrl: z.ZodOptional<z.ZodString>;
    description: z.ZodString;
    readingTime: z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>]>, z.ZodTransform<number, number>>, z.ZodNumber>;
    authorId: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    isPublished: z.ZodDefault<z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodPipe<z.ZodString, z.ZodTransform<boolean, string>>]>>>;
    content: z.ZodOptional<z.ZodAny>;
}, z.core.$strip>;
export declare const updateBlogSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    categoryId: z.ZodOptional<z.ZodString>;
    featuredImageUrl: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    readingTime: z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>]>, z.ZodTransform<number, number>>, z.ZodNumber>>;
    slug: z.ZodOptional<z.ZodString>;
    isPublished: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodPipe<z.ZodString, z.ZodTransform<boolean, string>>]>>;
    content: z.ZodOptional<z.ZodAny>;
}, z.core.$strip>;
export declare const blogQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>, z.ZodNumber>>>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>, z.ZodNumber>>>;
    search: z.ZodOptional<z.ZodString>;
    categoryId: z.ZodOptional<z.ZodString>;
    authorId: z.ZodOptional<z.ZodString>;
    isPublished: z.ZodOptional<z.ZodPipe<z.ZodEnum<{
        true: "true";
        false: "false";
    }>, z.ZodTransform<boolean, "true" | "false">>>;
    sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        createdAt: "createdAt";
        updatedAt: "updatedAt";
        readingTime: "readingTime";
        viewCount: "viewCount";
        reactCount: "reactCount";
    }>>>;
    sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>>;
}, z.core.$strip>;
export declare const blogIdSchema: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export declare const categoryIdSchema: z.ZodObject<{
    categoryId: z.ZodString;
}, z.core.$strip>;
export declare const authorIdSchema: z.ZodObject<{
    authorId: z.ZodString;
}, z.core.$strip>;
export declare const blogLikeSchema: z.ZodObject<{
    userId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const blogStatusSchema: z.ZodObject<{
    status: z.ZodEnum<{
        draft: "draft";
        published: "published";
    }>;
}, z.core.$strip>;
export declare const blogReactionSchema: z.ZodObject<{
    userId: z.ZodOptional<z.ZodString>;
    reactionType: z.ZodEnum<{
        LIKE: "LIKE";
        LOVE: "LOVE";
        HAHA: "HAHA";
        WOW: "WOW";
        SAD: "SAD";
        ANGRY: "ANGRY";
    }>;
}, z.core.$strip>;
export type CreateBlogType = z.infer<typeof createBlogSchema>;
export type UpdateBlogType = z.infer<typeof updateBlogSchema>;
export type BlogQueryType = z.infer<typeof blogQuerySchema>;
export type BlogIdType = z.infer<typeof blogIdSchema>;
export type CategoryIdType = z.infer<typeof categoryIdSchema>;
export type AuthorIdType = z.infer<typeof authorIdSchema>;
export type BlogLikeType = z.infer<typeof blogLikeSchema>;
export type BlogStatusType = z.infer<typeof blogStatusSchema>;
export type BlogReactionType = z.infer<typeof blogReactionSchema>;
//# sourceMappingURL=blog.type.d.ts.map