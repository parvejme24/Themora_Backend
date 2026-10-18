import { z } from "zod";

export const checkoutItemSchema = z
  .object({
    productId: z.string().uuid().optional(),
    planId: z.string().uuid().optional(),
    licenseType: z.enum(["SINGLE", "EXTENDED"]).default("SINGLE"),
  })
  .refine((item) => Boolean(item.productId) !== Boolean(item.planId), "Each item needs either productId or planId");

const customerSchema = z.object({
  email: z.string().trim().toLowerCase().email().optional(),
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(20).optional(),
});

export const checkoutSchema = z.object({
  items: z.array(checkoutItemSchema).min(1, "Your cart is empty").max(20),
  gateway: z.enum(["stripe", "sslcommerz"]),
  customer: customerSchema.default({}),
});

// Legacy single-product contract used by the current frontend
export const legacyCheckoutSchema = z.object({
  productType: z.enum(["template", "plan"]),
  productId: z.string().uuid(),
  customerEmail: z.string().trim().toLowerCase().email().optional(),
  customerName: z.string().trim().min(2).max(120).optional(),
  gateway: z.string().optional(),
});

export const stripeConfirmSchema = z.object({ sessionId: z.string().min(10).max(255) });

export const orderIdParamSchema = z.object({ id: z.string().uuid("Invalid order ID") });

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type LegacyCheckoutInput = z.infer<typeof legacyCheckoutSchema>;
