import { PricingPlan } from "@prisma/client";
export type CreatePricingPlanInput = Omit<PricingPlan, "id" | "createdAt" | "updatedAt">;
export type UpdatePricingPlanInput = Partial<CreatePricingPlanInput>;
//# sourceMappingURL=pricing.interface.d.ts.map