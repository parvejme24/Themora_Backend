import { z } from "zod";
export declare const createTemplateSchema: z.ZodObject<{
    title: z.ZodString;
    price: z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number, string | number>>, z.ZodNumber>;
    lemonsqueezyProductId: z.ZodOptional<z.ZodString>;
    lemonsqueezyVariantId: z.ZodOptional<z.ZodString>;
    lemonsqueezyPermalink: z.ZodOptional<z.ZodString>;
    imageUrl: z.ZodOptional<z.ZodString>;
    screenshots: z.ZodOptional<z.ZodArray<z.ZodString>>;
    previewLink: z.ZodOptional<z.ZodString>;
    sourceFiles: z.ZodOptional<z.ZodArray<z.ZodString>>;
    shortDescription: z.ZodString;
    description: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>, z.ZodTransform<string[], string | string[]>>>;
    whatsIncluded: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>, z.ZodTransform<string[], string | string[]>>>;
    keyFeatures: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodString;
    }, z.core.$strip>>]>, z.ZodTransform<any, string | {
        title: string;
        description: string;
    }[]>>>;
    version: z.ZodDefault<z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number, string | number>>, z.ZodNumber>>;
    pages: z.ZodDefault<z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number, string | number>>, z.ZodNumber>>;
    categoryId: z.ZodString;
    categoryName: z.ZodOptional<z.ZodString>;
    checkoutUrl: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const updateTemplateSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    price: z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number, string | number>>, z.ZodNumber>>;
    lemonsqueezyProductId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    lemonsqueezyVariantId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    lemonsqueezyPermalink: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    imageUrl: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    screenshots: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    previewLink: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    sourceFiles: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    shortDescription: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>, z.ZodTransform<string[], string | string[]>>>>;
    whatsIncluded: z.ZodOptional<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>, z.ZodTransform<string[], string | string[]>>>>;
    keyFeatures: z.ZodOptional<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodString;
    }, z.core.$strip>>]>, z.ZodTransform<any, string | {
        title: string;
        description: string;
    }[]>>>>;
    version: z.ZodOptional<z.ZodDefault<z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number, string | number>>, z.ZodNumber>>>;
    pages: z.ZodOptional<z.ZodDefault<z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number, string | number>>, z.ZodNumber>>>;
    categoryId: z.ZodOptional<z.ZodString>;
    categoryName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    checkoutUrl: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const templateIdSchema: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export declare const templateQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>, z.ZodNumber>>;
    limit: z.ZodDefault<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>, z.ZodNumber>>;
    search: z.ZodOptional<z.ZodString>;
    categoryId: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodDefault<z.ZodEnum<{
        createdAt: "createdAt";
        title: "title";
        price: "price";
        downloads: "downloads";
        totalPurchase: "totalPurchase";
    }>>;
    sortOrder: z.ZodDefault<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>;
    minPrice: z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>, z.ZodNumber>>;
    maxPrice: z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>, z.ZodNumber>>;
}, z.core.$strip>;
export declare const newArrivalsQuerySchema: z.ZodObject<{
    limit: z.ZodDefault<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>, z.ZodNumber>>;
}, z.core.$strip>;
export interface Template {
    id: string;
    title: string;
    price: number;
    lemonsqueezyProductId?: string | null;
    lemonsqueezyVariantId?: string | null;
    lemonsqueezyPermalink?: string | null;
    imageUrl?: string | null;
    screenshots: string[];
    previewLink?: string | null;
    sourceFiles: string[];
    shortDescription: string;
    description: string[];
    whatsIncluded: string[];
    keyFeatures: Array<{
        title: string;
        description: string;
    }>;
    version: number;
    pages: number;
    downloads: number;
    totalPurchase: number;
    categoryId: string;
    categoryName?: string;
    checkoutUrl?: string | null;
    createdAt: Date;
    updatedAt: Date;
    category: {
        id: string;
        title: string;
        slug?: string | null;
        image?: string | null;
    };
    links: Array<{
        id: string;
        linkTitle1: string;
        linkUrl1: string;
        linkTitle2: string;
        linkUrl2: string;
        linkTitle3: string;
        linkUrl3: string;
    }>;
}
export interface CreateTemplateInput {
    title: string;
    price: number;
    lemonsqueezyProductId?: string;
    lemonsqueezyVariantId?: string;
    lemonsqueezyPermalink?: string;
    imageUrl?: string;
    screenshots?: string[];
    previewLink?: string;
    sourceFiles?: string[];
    shortDescription: string;
    description?: string[];
    whatsIncluded?: string[];
    keyFeatures?: Array<{
        title: string;
        description: string;
    }>;
    version?: number;
    pages?: number;
    categoryId: string;
    categoryName?: string;
    checkoutUrl?: string;
}
export interface UpdateTemplateInput {
    title?: string;
    price?: number;
    lemonsqueezyProductId?: string;
    lemonsqueezyVariantId?: string;
    lemonsqueezyPermalink?: string;
    imageUrl?: string;
    screenshots?: string[];
    previewLink?: string;
    sourceFiles?: string[];
    shortDescription?: string;
    description?: string[];
    whatsIncluded?: string[];
    keyFeatures?: Array<{
        title: string;
        description: string;
    }>;
    version?: number;
    pages?: number;
    categoryId?: string;
    categoryName?: string;
    checkoutUrl?: string;
}
export interface TemplateQuery {
    page: number;
    limit: number;
    search?: string;
    categoryId?: string;
    sortBy: "title" | "price" | "createdAt" | "downloads" | "totalPurchase";
    sortOrder: "asc" | "desc";
    minPrice?: number;
    maxPrice?: number;
}
export interface PaginatedTemplates {
    templates: Template[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}
export interface TemplateStats {
    totalTemplates: number;
    totalDownloads: number;
    totalPurchases: number;
    averagePrice: number;
    categoryStats: Array<{
        categoryId: string;
        categoryName: string;
        templateCount: number;
        totalDownloads: number;
        totalPurchases: number;
    }>;
}
//# sourceMappingURL=template.type.d.ts.map