"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentService = exports.PaymentService = void 0;
const client_1 = require("@prisma/client");
const env_1 = require("../../config/env");
const prisma = new client_1.PrismaClient();
class PaymentService {
    async createCheckout(input, user) {
        if (!env_1.env.LEMONSQUEEZY_API_KEY || !env_1.env.LEMONSQUEEZY_STORE_ID) {
            throw new Error("Payment checkout is not configured");
        }
        const customerEmail = user?.email ?? input.customerEmail;
        const customerName = user?.fullName ?? input.customerName;
        if (!customerEmail)
            throw new Error("A valid email address is required");
        let variantId;
        let productTitle;
        if (input.productType === "template") {
            const template = await prisma.template.findUnique({
                where: { id: input.productId },
                select: { id: true, title: true, lemonsqueezyVariantId: true },
            });
            if (!template)
                throw new Error("Theme not found");
            variantId = template.lemonsqueezyVariantId;
            productTitle = template.title;
        }
        else {
            const plan = await prisma.pricingPlan.findFirst({
                where: { id: input.productId, isActive: true },
                select: { id: true, title: true, lemonsqueezyVariantId: true },
            });
            if (!plan)
                throw new Error("Pricing plan not found");
            variantId = plan.lemonsqueezyVariantId;
            productTitle = plan.title;
        }
        if (!variantId)
            throw new Error("This product is not configured for online checkout");
        const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
            method: "POST",
            headers: {
                Accept: "application/vnd.api+json",
                "Content-Type": "application/vnd.api+json",
                Authorization: `Bearer ${env_1.env.LEMONSQUEEZY_API_KEY}`,
            },
            body: JSON.stringify({
                data: {
                    type: "checkouts",
                    attributes: {
                        checkout_options: { embed: false },
                        checkout_data: {
                            email: customerEmail,
                            name: customerName,
                            custom: {
                                product_type: input.productType,
                                product_id: input.productId,
                                user_id: user?.id ?? "",
                            },
                        },
                        product_options: {
                            redirect_url: `${env_1.env.FRONTEND_URL.replace(/\/$/, "")}/purchase/success`,
                            receipt_button_text: "Return to Themora",
                        },
                        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                    },
                    relationships: {
                        store: { data: { type: "stores", id: env_1.env.LEMONSQUEEZY_STORE_ID } },
                        variant: { data: { type: "variants", id: variantId } },
                    },
                },
            }),
        });
        const result = await response.json();
        const checkoutUrl = result.data?.attributes?.url;
        if (!response.ok || !checkoutUrl) {
            console.error("Lemon Squeezy checkout request failed:", response.status, result.errors?.[0]?.title);
            throw new Error("Unable to start checkout with the payment provider");
        }
        return { checkoutUrl, productTitle };
    }
}
exports.PaymentService = PaymentService;
exports.paymentService = new PaymentService();
//# sourceMappingURL=payment.service.js.map