"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePricingPlan = exports.updatePricingPlan = exports.createPricingPlan = exports.getAllPricingPlans = exports.getPricingPlan = exports.getPricingPlans = void 0;
const pricing_service_1 = require("./pricing.service");
const cache_1 = require("../../middleware/cache");
const getPricingPlans = async (_req, res) => {
    try {
        const plans = await pricing_service_1.pricingService.getActivePlans();
        return res.status(200).json({ success: true, data: plans });
    }
    catch (error) {
        console.error("Error fetching pricing plans:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch pricing plans" });
    }
};
exports.getPricingPlans = getPricingPlans;
const getPricingPlan = async (req, res) => {
    try {
        const plan = await pricing_service_1.pricingService.getPlanById(req.params.id);
        if (!plan)
            return res.status(404).json({ success: false, message: "Pricing plan not found" });
        return res.status(200).json({ success: true, data: plan });
    }
    catch (error) {
        console.error("Error fetching pricing plan:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch pricing plan" });
    }
};
exports.getPricingPlan = getPricingPlan;
const getAllPricingPlans = async (_req, res) => {
    try {
        const plans = await pricing_service_1.pricingService.getAllPlans();
        return res.status(200).json({ success: true, data: plans });
    }
    catch (error) {
        console.error("Error fetching all pricing plans:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch pricing plans" });
    }
};
exports.getAllPricingPlans = getAllPricingPlans;
const createPricingPlan = async (req, res) => {
    try {
        const plan = await pricing_service_1.pricingService.createPlan(req.validatedBody);
        (0, cache_1.clearCache)("/api/v1/pricing");
        return res.status(201).json({ success: true, data: plan });
    }
    catch (error) {
        console.error("Error creating pricing plan:", error);
        return res.status(400).json({ success: false, message: "Failed to create pricing plan" });
    }
};
exports.createPricingPlan = createPricingPlan;
const updatePricingPlan = async (req, res) => {
    try {
        const plan = await pricing_service_1.pricingService.updatePlan(req.params.id, req.validatedBody);
        (0, cache_1.clearCache)("/api/v1/pricing");
        return res.status(200).json({ success: true, data: plan });
    }
    catch (error) {
        console.error("Error updating pricing plan:", error);
        return res.status(400).json({ success: false, message: "Failed to update pricing plan" });
    }
};
exports.updatePricingPlan = updatePricingPlan;
const deletePricingPlan = async (req, res) => {
    try {
        const plan = await pricing_service_1.pricingService.deactivatePlan(req.params.id);
        (0, cache_1.clearCache)("/api/v1/pricing");
        return res.status(200).json({ success: true, data: plan });
    }
    catch (error) {
        console.error("Error deactivating pricing plan:", error);
        return res.status(400).json({ success: false, message: "Failed to deactivate pricing plan" });
    }
};
exports.deletePricingPlan = deletePricingPlan;
//# sourceMappingURL=pricing.controller.js.map