import { z } from "zod";
import { ProductStatus, ProductType } from "@prisma/client";

const csvList = z
  .union([z.string(), z.array(z.string())])
  .transform((value) =>
    (Array.isArray(value) ? value : value.split(","))
      .map((item) => item.trim())
      .filter(Boolean)
  );

const booleanParam = z.enum(["true", "false"]).transform((value) => value === "true");

const optionalUrl = z.string().trim().url().optional().nullable();

export const productSortValues = [
  "newest",
  "popular",
  "bestselling",
  "rating",
  "price_asc",
  "price_desc",
  "downloads",
] as const;

export const productQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  type: csvList.pipe(z.array(z.nativeEnum(ProductType))).optional(),
  category: csvList.optional(),
  tech: csvList.optional(),
  platform: csvList.optional(),
  tag: csvList.optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  free: booleanParam.optional(),
  featured: booleanParam.optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
  sort: z.enum(productSortValues).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(12),
});

export const adminProductQuerySchema = productQuerySchema.extend({
  status: z.nativeEnum(ProductStatus).optional(),
});

export const relatedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export const productIdParamSchema = z.object({ id: z.string().uuid("Invalid product ID") });

export const productSlugParamSchema = z.object({ slug: z.string().min(1).max(120) });

const keyFeatureSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(""),
});

const productFields = {
  title: z.string().trim().min(3).max(200),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug may contain lowercase letters, numbers and dashes")
    .max(120)
    .optional(),
  shortDescription: z.string().trim().min(10).max(500),
  description: z.array(z.string().trim().min(1)).default([]),
  whatsIncluded: z.array(z.string().trim().min(1)).default([]),
  keyFeatures: z.array(keyFeatureSchema).default([]),
  productType: z.nativeEnum(ProductType).default("WEBSITE_TEMPLATE"),
  status: z.nativeEnum(ProductStatus).default("DRAFT"),
  categoryId: z.string().uuid("Invalid category ID"),
  price: z.coerce.number().min(0),
  salePrice: z.coerce.number().min(0).optional().nullable(),
  saleEndsAt: z.coerce.date().optional().nullable(),
  extendedPrice: z.coerce.number().min(0).optional().nullable(),
  isFree: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  techStack: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  platforms: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  tags: z.array(z.string().trim().min(1).max(40)).max(15).default([]),
  imageUrl: optionalUrl,
  screenshots: z.array(z.string().url()).max(20).default([]),
  previewLink: optionalUrl,
  apkUrl: optionalUrl,
  testflightUrl: optionalUrl,
  playStoreUrl: optionalUrl,
  appStoreUrl: optionalUrl,
  videoUrl: optionalUrl,
  figmaUrl: optionalUrl,
  sourceFiles: z.array(z.string().min(1)).default([]),
  fileSize: z.string().trim().max(20).optional().nullable(),
  version: z.coerce.number().positive().default(1),
  pages: z.coerce.number().int().min(1).default(1),
};

const checkPrices = (data: { isFree?: boolean; price?: number; salePrice?: number | null }, ctx: z.RefinementCtx) => {
  if (data.isFree && data.price !== undefined && data.price !== 0) {
    ctx.addIssue({ code: "custom", path: ["price"], message: "Free products must have a price of 0" });
  }
  if (data.salePrice != null && data.price !== undefined && data.salePrice >= data.price) {
    ctx.addIssue({ code: "custom", path: ["salePrice"], message: "Sale price must be lower than the regular price" });
  }
};

export const createProductSchema = z.object(productFields).superRefine(checkPrices);

// No defaults on update, so omitted fields stay unchanged
const updateFields = Object.fromEntries(
  Object.entries(productFields).map(([key, schema]) => [
    key,
    (schema instanceof z.ZodDefault ? schema.removeDefault() : schema).optional(),
  ])
) as unknown as { [K in keyof typeof productFields]: z.ZodOptional<z.ZodTypeAny> };

export const updateProductSchema = z.object(updateFields).superRefine(checkPrices as any);

export const saleSchema = z
  .object({
    productIds: z.array(z.string().uuid()).max(200).optional(),
    categoryId: z.string().uuid().optional(),
    percent: z.number().int().min(1).max(90),
    endsAt: z.coerce.date().refine((date) => date > new Date(), "The sale must end in the future"),
  })
  .refine((data) => Boolean(data.productIds?.length) !== Boolean(data.categoryId), "Choose either productIds or a categoryId");

export const endSaleSchema = z
  .object({
    productIds: z.array(z.string().uuid()).max(200).optional(),
    categoryId: z.string().uuid().optional(),
  })
  .refine((data) => Boolean(data.productIds?.length) !== Boolean(data.categoryId), "Choose either productIds or a categoryId");

export const importProductsSchema = z.object({
  csv: z.string().min(1, "The CSV is empty").max(5_000_000, "The CSV is larger than 5 MB"),
  dryRun: z.boolean().default(false),
});

export type ProductQuery = z.infer<typeof adminProductQuerySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = Partial<CreateProductInput>;
