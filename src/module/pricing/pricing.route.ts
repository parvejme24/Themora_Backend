import { Router } from "express";
import {
	createPricingPlan,
	deletePricingPlan,
	getAllPricingPlans,
	getPricingPlan,
	getPricingPlans,
	updatePricingPlan,
} from "./pricing.controller";
import { authenticateAdminAndCheckStatus } from "../../middleware/authMiddleware";
import { cacheResponse } from "../../middleware/cache";
import { validateCreatePricingPlan, validatePricingPlanId, validateUpdatePricingPlan } from "./pricing.validate";

const router = Router();

router.get("/pricing", cacheResponse(60), getPricingPlans);
router.get("/admin/pricing", authenticateAdminAndCheckStatus, getAllPricingPlans);
router.post("/pricing", authenticateAdminAndCheckStatus, validateCreatePricingPlan, createPricingPlan);
router.get("/pricing/:id", validatePricingPlanId, getPricingPlan);
router.put("/pricing/:id", authenticateAdminAndCheckStatus, validatePricingPlanId, validateUpdatePricingPlan, updatePricingPlan);
router.delete("/pricing/:id", authenticateAdminAndCheckStatus, validatePricingPlanId, deletePricingPlan);

export default router;
