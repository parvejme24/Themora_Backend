import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { pricingPlanParamsSchema, pricingPlanSchema, updatePricingPlanSchema } from "./pricing.type";

const validate = (schema: z.ZodType) => (req: Request, res: Response, next: NextFunction) => {
	const result = schema.safeParse(req);
	if (!result.success) {
		res.status(400).json({ success: false, message: "Validation failed", errors: result.error.issues });
		return;
	}
	const data = result.data as { body?: unknown; params?: unknown };
	if (data.body) (req as any).validatedBody = data.body;
	if (data.params) (req as any).validatedParams = data.params;
	next();
};

export const validateCreatePricingPlan = validate(z.object({ body: pricingPlanSchema }));
export const validateUpdatePricingPlan = validate(z.object({ body: updatePricingPlanSchema }));
export const validatePricingPlanId = validate(z.object({ params: pricingPlanParamsSchema }));
