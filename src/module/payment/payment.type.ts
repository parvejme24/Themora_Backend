import { z } from "zod";

export const createCheckoutSchema = z.object({
  productType: z.enum(["template", "plan"]),
  productId: z.string().uuid(),
  customerEmail: z.string().email().optional(),
  customerName: z.string().trim().min(2).max(120).optional(),
  gateway: z.enum(["lemonsqueezy", "fastspring", "auto"]).optional().default("auto"),
});

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
