import { prisma } from "../../config/database";
import { CreatePricingPlanInput, UpdatePricingPlanInput } from "./pricing.interface";

const defaultPlans: CreatePricingPlanInput[] = [
	{
		slug: "personal",
		title: "Personal",
		description: "3 Website Licenses",
		price: 10,
		currency: "USD",
		recommended: false,
		features: ["Access to All Templates", "SP Page Builder Pro", "Access to All Extensions", "Access to All Layout Bundles", "3 Websites License", "1 Year Support & Updates"],
		websiteLimit: 3,
		lemonsqueezyVariantId: null,
		isActive: true,
		sortOrder: 0,
	},
	{
		slug: "business",
		title: "Business",
		description: "10 Website Licenses",
		price: 199,
		currency: "USD",
		recommended: true,
		features: ["Access to All Templates", "SP Page Builder Pro", "Access to All Extensions", "Access to All Layout Bundles", "10 Websites License", "1 Year Support & Updates"],
		websiteLimit: 10,
		lemonsqueezyVariantId: null,
		isActive: true,
		sortOrder: 1,
	},
	{
		slug: "agency",
		title: "Agency",
		description: "Unlimited Website Licenses",
		price: 499,
		currency: "USD",
		recommended: false,
		features: ["Access to All Templates", "SP Page Builder Pro", "Access to All Extensions", "Access to All Layout Bundles", "Unlimited Website Licenses", "1 Year Support & Updates"],
		websiteLimit: null,
		lemonsqueezyVariantId: null,
		isActive: true,
		sortOrder: 2,
	},
];

export class PricingService {
	private async ensureDefaultPlans() {
		await Promise.all(defaultPlans.map((plan) => prisma.pricingPlan.upsert({
			where: { slug: plan.slug },
			create: plan,
			update: {},
		})));
	}

	async getActivePlans() {
		await this.ensureDefaultPlans();
		return prisma.pricingPlan.findMany({
			where: { isActive: true },
			orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
		});
	}

	async getAllPlans() {
		await this.ensureDefaultPlans();
		return prisma.pricingPlan.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
	}

	async getPlanById(id: string) {
		await this.ensureDefaultPlans();
		return prisma.pricingPlan.findFirst({ where: { id, isActive: true } });
	}

	async createPlan(data: CreatePricingPlanInput) {
		return prisma.pricingPlan.create({ data });
	}

	async updatePlan(id: string, data: UpdatePricingPlanInput) {
		return prisma.pricingPlan.update({ where: { id }, data });
	}

	async deactivatePlan(id: string) {
		return prisma.pricingPlan.update({ where: { id }, data: { isActive: false } });
	}
}

export const pricingService = new PricingService();
