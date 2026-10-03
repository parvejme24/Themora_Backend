import { z } from "zod";

export const pricingPlanSchema = z.object({
	slug: z.string().trim().regex(/^[a-z0-9-]+$/),
	title: z.string().trim().min(2).max(80),
	description: z.string().trim().min(2).max(240),
	price: z.number().positive(),
	currency: z.string().trim().length(3).default("USD"),
	recommended: z.boolean().default(false),
	features: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
	websiteLimit: z.number().int().positive().nullable().optional(),
	lemonsqueezyVariantId: z.string().trim().min(1).nullable().optional(),
	isActive: z.boolean().default(true),
	sortOrder: z.number().int().default(0),
});

export const updatePricingPlanSchema = pricingPlanSchema.partial();

export const pricingPlanParamsSchema = z.object({
	id: z.string().uuid(),
});
