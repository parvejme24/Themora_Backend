"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pricingService = exports.PricingService = void 0;
const database_1 = require("../../config/database");
const defaultPlans = [
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
class PricingService {
    async ensureDefaultPlans() {
        try {
            for (const plan of defaultPlans) {
                await database_1.prisma.pricingPlan.upsert({
                    where: { slug: plan.slug },
                    create: plan,
                    update: {},
                });
            }
        }
        catch (error) {
            console.warn("Could not ensure default pricing plans:", error);
        }
    }
    async getActivePlans() {
        await this.ensureDefaultPlans();
        return database_1.prisma.pricingPlan.findMany({
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        });
    }
    async getAllPlans() {
        await this.ensureDefaultPlans();
        return database_1.prisma.pricingPlan.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    }
    async getPlanById(id) {
        await this.ensureDefaultPlans();
        return database_1.prisma.pricingPlan.findFirst({ where: { id, isActive: true } });
    }
    async createPlan(data) {
        return database_1.prisma.pricingPlan.create({ data });
    }
    async updatePlan(id, data) {
        return database_1.prisma.pricingPlan.update({ where: { id }, data });
    }
    async deactivatePlan(id) {
        return database_1.prisma.pricingPlan.update({ where: { id }, data: { isActive: false } });
    }
}
exports.PricingService = PricingService;
exports.pricingService = new PricingService();
//# sourceMappingURL=pricing.service.js.map