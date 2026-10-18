import { z } from "zod";

// Template validation schemas
export const createTemplateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must not exceed 200 characters"),
  price: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) throw new Error("Price must be a valid number");
    return num;
  }).pipe(z.number().positive("Price must be positive")),
  imageUrl: z.string().url().optional(),
  screenshots: z.array(z.string().url()).optional(),
  previewLink: z.string().url().optional(),
  sourceFiles: z.array(z.string()).optional(),
  shortDescription: z.string().min(1, "Short description is required").max(500, "Short description must not exceed 500 characters"),
  description: z.union([z.string(), z.array(z.string())]).transform((val) => {
    if (typeof val === 'string') {
      return val.split('\n').filter(item => item.trim() !== '');
    }
    return val;
  }).optional(),
  whatsIncluded: z.union([z.string(), z.array(z.string())]).transform((val) => {
    if (typeof val === 'string') {
      return val.split('\n').filter(item => item.trim() !== '');
    }
    return val;
  }).optional(),
  keyFeatures: z.union([z.string(), z.array(z.object({
    title: z.string(),
    description: z.string()
  }))]).transform((val) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return [];
      }
    }
    return val;
  }).optional(),
  version: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) throw new Error("Version must be a valid number");
    return num;
  }).pipe(z.number().positive("Version must be positive")).default(1.0),
  pages: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseInt(val) : val;
    if (isNaN(num)) throw new Error("Pages must be a valid number");
    return num;
  }).pipe(z.number().int().positive("Pages must be positive")).default(1),
  categoryId: z.string().uuid("Invalid category ID"),
  categoryName: z.string().optional(),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const templateIdSchema = z.object({
  id: z.string().uuid("Invalid template ID"),
});

export const templateQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).default(1),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).default(10),
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  sortBy: z.enum(["title", "price", "createdAt", "downloads", "totalPurchase"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  minPrice: z.string().transform(Number).pipe(z.number().positive()).optional(),
  maxPrice: z.string().transform(Number).pipe(z.number().positive()).optional(),
});

export const newArrivalsQuerySchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(50)).default(20),
});

// Template interfaces
export interface Template {
  id: string;
  title: string;
  price: number;
  imageUrl?: string | null;
  screenshots: string[];
  previewLink?: string | null;
  sourceFiles: string[];
  shortDescription: string;
  description: string[];
  whatsIncluded: string[];
  keyFeatures: Array<{ title: string; description: string }>;
  version: number;
  pages: number;
  downloads: number;
  totalPurchase: number;
  categoryId: string;
  categoryName?: string;
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
  imageUrl?: string;
  screenshots?: string[];
  previewLink?: string;
  sourceFiles?: string[];
  shortDescription: string;
  description?: string[];
  whatsIncluded?: string[];
  keyFeatures?: Array<{ title: string; description: string }>;
  version?: number;
  pages?: number;
  categoryId: string;
  categoryName?: string;
}

export interface UpdateTemplateInput {
  title?: string;
  price?: number;
  imageUrl?: string;
  screenshots?: string[];
  previewLink?: string;
  sourceFiles?: string[];
  shortDescription?: string;
  description?: string[];
  whatsIncluded?: string[];
  keyFeatures?: Array<{ title: string; description: string }>;
  version?: number;
  pages?: number;
  categoryId?: string;
  categoryName?: string;
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
