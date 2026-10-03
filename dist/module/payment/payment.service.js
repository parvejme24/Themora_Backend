"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentService = exports.PaymentService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../../config/database");
const env_1 = require("../../config/env");
class PaymentService {
    generateLicenseKey() {
        const segments = [
            "THMR",
            crypto_1.default.randomBytes(2).toString("hex").toUpperCase(),
            crypto_1.default.randomBytes(2).toString("hex").toUpperCase(),
            crypto_1.default.randomBytes(2).toString("hex").toUpperCase(),
        ];
        return segments.join("-");
    }
    async createCheckout(input, user) {
        const customerEmail = (user?.email ?? input.customerEmail)?.trim().toLowerCase();
        const customerName = (user?.fullName ?? input.customerName)?.trim() || "Valued Customer";
        if (!customerEmail)
            throw new Error("A valid email address is required");
        let productTitle;
        let productPrice;
        let variantId;
        let directCheckoutUrl;
        let templateData = null;
        let planData = null;
        if (input.productType === "template") {
            templateData = await database_1.prisma.template.findUnique({
                where: { id: input.productId },
                select: {
                    id: true,
                    title: true,
                    price: true,
                    lemonsqueezyVariantId: true,
                    checkoutUrl: true,
                    lemonsqueezyPermalink: true,
                    sourceFiles: true,
                },
            });
            if (!templateData)
                throw new Error("Theme not found");
            productTitle = templateData.title;
            productPrice = templateData.price;
            variantId = templateData.lemonsqueezyVariantId;
            directCheckoutUrl = templateData.checkoutUrl || templateData.lemonsqueezyPermalink;
            if (!directCheckoutUrl && variantId?.startsWith("http")) {
                directCheckoutUrl = variantId;
            }
        }
        else {
            planData = await database_1.prisma.pricingPlan.findFirst({
                where: { id: input.productId, isActive: true },
                select: {
                    id: true,
                    slug: true,
                    title: true,
                    price: true,
                    websiteLimit: true,
                    lemonsqueezyVariantId: true,
                },
            });
            if (!planData)
                throw new Error("Pricing plan not found");
            productTitle = planData.title;
            productPrice = planData.price;
            variantId = planData.lemonsqueezyVariantId;
            if (variantId?.startsWith("http")) {
                directCheckoutUrl = variantId;
            }
        }
        const gateway = input.gateway || "auto";
        if (gateway === "fastspring" || (!env_1.env.LEMONSQUEEZY_API_KEY && process.env.FASTSPRING_USERNAME)) {
            const fastspringStorefront = process.env.FASTSPRING_STORE_FRONT || "themora";
            const productSlug = (input.productType === "template" ? templateData?.title : planData?.slug) || "themora-product";
            const cleanSlug = productSlug.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            try {
                const fsUrl = new URL(`https://${fastspringStorefront}.onfastspring.com/checkout`);
                fsUrl.searchParams.set("products[0][path]", cleanSlug);
                fsUrl.searchParams.set("products[0][quantity]", "1");
                fsUrl.searchParams.set("tags[customer_email]", customerEmail);
                fsUrl.searchParams.set("tags[customer_name]", customerName);
                fsUrl.searchParams.set("tags[product_id]", input.productId);
                fsUrl.searchParams.set("tags[product_type]", input.productType);
                if (user?.id)
                    fsUrl.searchParams.set("tags[user_id]", user.id);
                return {
                    checkoutUrl: fsUrl.toString(),
                    productTitle,
                    gateway: "fastspring",
                };
            }
            catch (e) {
                console.warn("Could not construct FastSpring URL, falling back to direct purchase flow:", e);
            }
        }
        if (env_1.env.LEMONSQUEEZY_API_KEY && env_1.env.LEMONSQUEEZY_STORE_ID && variantId && /^\d+$/.test(variantId)) {
            try {
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
                if (response.ok) {
                    const result = (await response.json());
                    const checkoutUrl = result.data?.attributes?.url;
                    if (checkoutUrl) {
                        return { checkoutUrl, productTitle, gateway: "lemonsqueezy" };
                    }
                }
            }
            catch (err) {
                console.warn("Lemon Squeezy API call error, trying direct link or fallback:", err);
            }
        }
        if (directCheckoutUrl && directCheckoutUrl.startsWith("http")) {
            try {
                const targetUrl = new URL(directCheckoutUrl);
                targetUrl.searchParams.set("checkout[email]", customerEmail);
                targetUrl.searchParams.set("checkout[name]", customerName);
                if (user?.id)
                    targetUrl.searchParams.set("checkout[custom][user_id]", user.id);
                targetUrl.searchParams.set("checkout[custom][product_id]", input.productId);
                targetUrl.searchParams.set("checkout[custom][product_type]", input.productType);
                return {
                    checkoutUrl: targetUrl.toString(),
                    productTitle,
                    gateway: gateway === "fastspring" ? "fastspring" : "lemonsqueezy",
                };
            }
            catch {
                return {
                    checkoutUrl: directCheckoutUrl,
                    productTitle,
                    gateway: gateway === "fastspring" ? "fastspring" : "lemonsqueezy",
                };
            }
        }
        const orderNumber = `THMR-${Date.now().toString(36).toUpperCase()}-${crypto_1.default.randomBytes(2).toString("hex").toUpperCase()}`;
        const order = await database_1.prisma.orderInvoice.create({
            data: {
                userId: user?.id || null,
                templateId: input.productType === "template" ? input.productId : null,
                pricingPlanId: input.productType === "plan" ? input.productId : null,
                lemonsqueezyOrderId: orderNumber,
                lemonsqueezyInvoiceId: `INV-${orderNumber}`,
                status: "COMPLETED",
                totalAmount: productPrice,
                currency: "USD",
                licenseType: "SINGLE",
                paymentMethod: gateway === "fastspring" ? "FastSpring" : "Lemon Squeezy",
                customerEmail,
                customerName,
                billingAddress: { email: customerEmail, name: customerName },
                downloadLinks: templateData?.sourceFiles?.map((_, idx) => String(idx)) || [],
            },
        });
        if (input.productType === "template") {
            await database_1.prisma.license.create({
                data: {
                    orderId: order.id,
                    templateId: input.productId,
                    userId: user?.id || null,
                    licenseType: "SINGLE",
                    licenseKey: this.generateLicenseKey(),
                    lemonsqueezyOrderId: orderNumber,
                    isActive: true,
                    maxUsage: 1,
                    activationLimit: 1,
                    usedCount: 0,
                },
            });
            await database_1.prisma.template.update({
                where: { id: input.productId },
                data: { totalPurchase: { increment: 1 }, downloads: { increment: 1 } },
            }).catch(() => { });
        }
        else if (input.productType === "plan" && planData) {
            const supportExpiresAt = new Date();
            supportExpiresAt.setFullYear(supportExpiresAt.getFullYear() + 1);
            await database_1.prisma.planEntitlement.create({
                data: {
                    pricingPlanId: planData.id,
                    orderId: order.id,
                    userId: user?.id || null,
                    customerEmail,
                    websitesAllowed: planData.websiteLimit,
                    supportExpiresAt,
                    isActive: true,
                },
            });
        }
        const successRedirectUrl = `${env_1.env.FRONTEND_URL.replace(/\/$/, "")}/purchase/success?order_id=${order.id}`;
        return {
            checkoutUrl: successRedirectUrl,
            productTitle,
            orderId: order.id,
            gateway: "instant",
        };
    }
}
exports.PaymentService = PaymentService;
exports.paymentService = new PaymentService();
//# sourceMappingURL=payment.service.js.map