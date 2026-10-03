import { z } from "zod";
export declare const pricingPlanSchema: z.ZodObject<{
    slug: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    price: z.ZodNumber;
    currency: z.ZodDefault<z.ZodString>;
    recommended: z.ZodDefault<z.ZodBoolean>;
    features: z.ZodArray<z.ZodString>;
    websiteLimit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    lemonsqueezyVariantId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    sortOrder: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export declare const updatePricingPlanSchema: z.ZodObject<{
    slug: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    price: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    recommended: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    features: z.ZodOptional<z.ZodArray<z.ZodString>>;
    websiteLimit: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    lemonsqueezyVariantId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    isActive: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    sortOrder: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
}, z.core.$strip>;
export declare const pricingPlanParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=pricing.type.d.ts.map