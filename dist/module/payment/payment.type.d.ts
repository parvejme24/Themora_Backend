import { z } from "zod";
export declare const createCheckoutSchema: z.ZodObject<{
    productType: z.ZodEnum<{
        template: "template";
        plan: "plan";
    }>;
    productId: z.ZodString;
    customerEmail: z.ZodOptional<z.ZodString>;
    customerName: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
//# sourceMappingURL=payment.type.d.ts.map