import { z } from "zod";

const fileSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    cloudinaryId: z.string().trim().min(1).max(300).optional(),
    url: z.string().url().optional(),
    size: z.number().int().positive().optional(),
  })
  .refine((file) => Boolean(file.cloudinaryId) !== Boolean(file.url), "Each file needs either a cloudinaryId or a url");

export const createVersionSchema = z.object({
  version: z
    .string()
    .trim()
    .regex(/^\d+(\.\d+){0,3}$/, "Use a version number like 2.1 or 2.1.0"),
  changelog: z.string().trim().max(10_000).default(""),
  files: z.array(fileSchema).min(1, "Upload at least one file").max(10),
  makeLatest: z.boolean().default(true),
  notifyBuyers: z.boolean().default(false),
});

export const updateVersionSchema = z
  .object({
    changelog: z.string().trim().max(10_000).optional(),
    isLatest: z.literal(true).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "Nothing to update");

export const uploadSignatureSchema = z.object({ kind: z.enum(["source", "image"]) });

export const downloadRequestSchema = z.object({
  versionId: z.string().uuid().optional(),
  fileId: z.string().uuid().optional(),
});

export const productIdParamSchema = z.object({ productId: z.string().uuid("Invalid product ID") });
export const idParamSchema = z.object({ id: z.string().uuid() });
export const slugParamSchema = z.object({ slug: z.string().min(1).max(120) });

export type CreateVersionInput = z.infer<typeof createVersionSchema>;
export type UpdateVersionInput = z.infer<typeof updateVersionSchema>;
