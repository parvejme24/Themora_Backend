"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pricing_controller_1 = require("./pricing.controller");
const authMiddleware_1 = require("../../middleware/authMiddleware");
const cache_1 = require("../../middleware/cache");
const pricing_validate_1 = require("./pricing.validate");
const router = (0, express_1.Router)();
router.get("/pricing", (0, cache_1.cacheResponse)(60), pricing_controller_1.getPricingPlans);
router.get("/pricing/plans", (0, cache_1.cacheResponse)(60), pricing_controller_1.getPricingPlans);
router.get("/pricing-plans", (0, cache_1.cacheResponse)(60), pricing_controller_1.getPricingPlans);
router.get("/admin/pricing", authMiddleware_1.authenticateAdminAndCheckStatus, pricing_controller_1.getAllPricingPlans);
router.post("/pricing", authMiddleware_1.authenticateAdminAndCheckStatus, pricing_validate_1.validateCreatePricingPlan, pricing_controller_1.createPricingPlan);
router.get("/pricing/:id", pricing_validate_1.validatePricingPlanId, pricing_controller_1.getPricingPlan);
router.put("/pricing/:id", authMiddleware_1.authenticateAdminAndCheckStatus, pricing_validate_1.validatePricingPlanId, pricing_validate_1.validateUpdatePricingPlan, pricing_controller_1.updatePricingPlan);
router.delete("/pricing/:id", authMiddleware_1.authenticateAdminAndCheckStatus, pricing_validate_1.validatePricingPlanId, pricing_controller_1.deletePricingPlan);
exports.default = router;
//# sourceMappingURL=pricing.route.js.map