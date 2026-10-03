import { Request, Response } from "express";
import { pricingService } from "./pricing.service";
import { clearCache } from "../../middleware/cache";

export const getPricingPlans = async (_req: Request, res: Response) => {
	try {
		const plans = await pricingService.getActivePlans();
		return res.status(200).json({ success: true, data: plans });
	} catch (error) {
		console.error("Error fetching pricing plans:", error);
		return res.status(500).json({ success: false, message: "Failed to fetch pricing plans" });
	}
};

export const getPricingPlan = async (req: Request, res: Response) => {
	try {
		const plan = await pricingService.getPlanById(req.params.id);
		if (!plan) return res.status(404).json({ success: false, message: "Pricing plan not found" });
		return res.status(200).json({ success: true, data: plan });
	} catch (error) {
		console.error("Error fetching pricing plan:", error);
		return res.status(500).json({ success: false, message: "Failed to fetch pricing plan" });
	}
};

export const getAllPricingPlans = async (_req: Request, res: Response) => {
	try {
		const plans = await pricingService.getAllPlans();
		return res.status(200).json({ success: true, data: plans });
	} catch (error) {
		console.error("Error fetching all pricing plans:", error);
		return res.status(500).json({ success: false, message: "Failed to fetch pricing plans" });
	}
};

export const createPricingPlan = async (req: Request, res: Response) => {
	try {
		const plan = await pricingService.createPlan((req as any).validatedBody);
		clearCache("/api/v1/pricing");
		return res.status(201).json({ success: true, data: plan });
	} catch (error) {
		console.error("Error creating pricing plan:", error);
		return res.status(400).json({ success: false, message: "Failed to create pricing plan" });
	}
};

export const updatePricingPlan = async (req: Request, res: Response) => {
	try {
		const plan = await pricingService.updatePlan(req.params.id, (req as any).validatedBody);
		clearCache("/api/v1/pricing");
		return res.status(200).json({ success: true, data: plan });
	} catch (error) {
		console.error("Error updating pricing plan:", error);
		return res.status(400).json({ success: false, message: "Failed to update pricing plan" });
	}
};

export const deletePricingPlan = async (req: Request, res: Response) => {
	try {
		const plan = await pricingService.deactivatePlan(req.params.id);
		clearCache("/api/v1/pricing");
		return res.status(200).json({ success: true, data: plan });
	} catch (error) {
		console.error("Error deactivating pricing plan:", error);
		return res.status(400).json({ success: false, message: "Failed to deactivate pricing plan" });
	}
};
