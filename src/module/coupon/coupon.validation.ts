import { z } from "zod";
import { checkoutItemSchema } from "../payment/payment.validation";

const couponFields = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/, "Codes may contain letters, numbers, dashes and underscores"),
  description: z.string().trim().max(200).optional().nullable(),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.number().positive(),
  minSubtotal: z.number().min(0).optional().nullable(),
  maxDiscount: z.number().positive().optional().nullable(),
  maxUses: z.number().int().positive().optional().nullable(),
  perUserLimit: z.number().int().positive().optional().nullable(),
  firstOrderOnly: z.boolean().optional(),
  productIds: z.array(z.string().uuid()).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
  isActive: z.boolean().optional(),
});

const checkCoupon = (data: Partial<z.infer<typeof couponFields>>, ctx: z.RefinementCtx) => {
  if (data.type === "PERCENT" && data.value !== undefined && data.value > 100) {
    ctx.addIssue({ code: "custom", path: ["value"], message: "A percentage discount cannot exceed 100" });
  }
  if (data.startsAt && data.endsAt && data.endsAt <= data.startsAt) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End date must be after the start date" });
  }
};

export const createCouponSchema = couponFields.superRefine(checkCoupon);
export const updateCouponSchema = couponFields.partial().superRefine(checkCoupon);

export const couponQuerySchema = z.object({
  q: z.string().trim().max(30).optional(),
  active: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const couponIdParamSchema = z.object({ id: z.string().uuid("Invalid coupon ID") });

export const validateCouponSchema = z.object({
  code: z.string().trim().min(1).max(30),
  items: z.array(checkoutItemSchema).min(1).max(20),
  email: z.string().trim().toLowerCase().email().optional(),
});

export type CouponInput = z.infer<typeof createCouponSchema>;
export type CouponQuery = z.infer<typeof couponQuerySchema>;
