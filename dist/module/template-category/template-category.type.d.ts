import { z } from "zod";
export declare const createTemplateCategorySchema: z.ZodObject<{
    title: z.ZodString;
    slug: z.ZodOptional<z.ZodString>;
    image: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
}, z.core.$strip>;
export declare const updateTemplateCategorySchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    image: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
}, z.core.$strip>;
export declare const templateCategoryIdSchema: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export declare const templateCategoryQuerySchema: z.ZodObject<{
    page: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    limit: z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<number, string | undefined>>;
    search: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        createdAt: "createdAt";
        updatedAt: "updatedAt";
        title: "title";
        templateCount: "templateCount";
    }>>>;
    sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>>;
}, z.core.$strip>;
export type CreateTemplateCategoryInput = z.infer<typeof createTemplateCategorySchema>;
export type UpdateTemplateCategoryInput = z.infer<typeof updateTemplateCategorySchema>;
export type TemplateCategoryIdParams = z.infer<typeof templateCategoryIdSchema>;
export type TemplateCategoryQueryParams = z.infer<typeof templateCategoryQuerySchema>;
export interface TemplateCategory {
    id: string;
    title: string;
    slug: string | null;
    image: string | null;
    templateCount: number;
    createdAt: Date;
    updatedAt: Date;
    templates?: Template[];
}
export interface Template {
    id: string;
    title: string;
    price: number;
    imageUrl: string | null;
    shortDescription: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface PaginatedTemplateCategories {
    categories: TemplateCategory[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}
export interface TemplateCategoryStats {
    totalCategories: number;
    totalTemplates: number;
    averageTemplatesPerCategory: number;
    mostPopularCategory: TemplateCategory | null;
}
//# sourceMappingURL=template-category.type.d.ts.map