"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePricingPlanId = exports.validateUpdatePricingPlan = exports.validateCreatePricingPlan = void 0;
const zod_1 = require("zod");
const pricing_type_1 = require("./pricing.type");
const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req);
    if (!result.success) {
        res.status(400).json({ success: false, message: "Validation failed", errors: result.error.issues });
        return;
    }
    const data = result.data;
    if (data.body)
        req.validatedBody = data.body;
    if (data.params)
        req.validatedParams = data.params;
    next();
};
exports.validateCreatePricingPlan = validate(zod_1.z.object({ body: pricing_type_1.pricingPlanSchema }));
exports.validateUpdatePricingPlan = validate(zod_1.z.object({ body: pricing_type_1.updatePricingPlanSchema }));
exports.validatePricingPlanId = validate(zod_1.z.object({ params: pricing_type_1.pricingPlanParamsSchema }));
//# sourceMappingURL=pricing.validate.js.map