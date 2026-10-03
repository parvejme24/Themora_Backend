"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pricingPlanParamsSchema = exports.updatePricingPlanSchema = exports.pricingPlanSchema = void 0;
const zod_1 = require("zod");
exports.pricingPlanSchema = zod_1.z.object({
    slug: zod_1.z.string().trim().regex(/^[a-z0-9-]+$/),
    title: zod_1.z.string().trim().min(2).max(80),
    description: zod_1.z.string().trim().min(2).max(240),
    price: zod_1.z.number().positive(),
    currency: zod_1.z.string().trim().length(3).default("USD"),
    recommended: zod_1.z.boolean().default(false),
    features: zod_1.z.array(zod_1.z.string().trim().min(1).max(120)).min(1).max(20),
    websiteLimit: zod_1.z.number().int().positive().nullable().optional(),
    lemonsqueezyVariantId: zod_1.z.string().trim().min(1).nullable().optional(),
    isActive: zod_1.z.boolean().default(true),
    sortOrder: zod_1.z.number().int().default(0),
});
exports.updatePricingPlanSchema = exports.pricingPlanSchema.partial();
exports.pricingPlanParamsSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
});
//# sourceMappingURL=pricing.type.js.map