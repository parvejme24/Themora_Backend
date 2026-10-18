import crypto from "node:crypto";
import { LicenseType, PaymentProvider } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/AppError";
import { fulfillmentService } from "./fulfillment.service";
import { GatewaySession } from "./gateways/gateway.types";
import { sslcommerzGateway } from "./gateways/sslcommerz.gateway";
import { stripeGateway } from "./gateways/stripe.gateway";
import { checkoutReturnUrls } from "./payment.urls";
import { CheckoutInput, LegacyCheckoutInput } from "./payment.validation";

interface CheckoutUser {
  id: string;
  email: string;
  fullName: string;
}

interface PricedItem {
  productId?: string;
  pricingPlanId?: string;
  title: string;
  licenseType: LicenseType;
  unitPrice: number;
  discount: number;
  total: number;
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

// THM-261019-7KQ2XD: date + random, readable on receipts and support tickets
export const generateOrderNumber = () => {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const random = crypto.randomBytes(4).toString("base64url").replace(/[-_]/g, "").toUpperCase().slice(0, 6);
  return `THM-${date}-${random}`;
};

const gatewayLabels: Record<PaymentProvider, string> = {
  STRIPE: "Stripe",
  SSLCOMMERZ: "SSLCommerz",
  FREE: "Free",
  MANUAL: "Manual",
};

export class CheckoutService {
  // Prices always come from the database, never from the client
  private async priceItems(items: CheckoutInput["items"]): Promise<PricedItem[]> {
    const productIds = items.flatMap((item) => (item.productId ? [item.productId] : []));
    const planIds = items.flatMap((item) => (item.planId ? [item.planId] : []));

    if (new Set(productIds).size !== productIds.length) throw AppError.badRequest("A product appears more than once in the cart");
    if (planIds.length > 1) throw AppError.badRequest("Only one pricing plan can be bought per order");

    const [products, plans] = await Promise.all([
      prisma.template.findMany({
        where: { id: { in: productIds }, status: "PUBLISHED" },
        select: { id: true, title: true, price: true, salePrice: true, extendedPrice: true, isFree: true },
      }),
      prisma.pricingPlan.findMany({ where: { id: { in: planIds }, isActive: true }, select: { id: true, title: true, price: true } }),
    ]);
    const productById = new Map(products.map((product) => [product.id, product]));
    const planById = new Map(plans.map((plan) => [plan.id, plan]));

    return items.map((item) => {
      if (item.productId) {
        const product = productById.get(item.productId);
        if (!product) throw AppError.notFound("A product in your cart is no longer available");

        let unitPrice: number;
        if (product.isFree) unitPrice = 0;
        else if (item.licenseType === "EXTENDED") {
          if (product.extendedPrice == null) throw AppError.badRequest(`"${product.title}" is not sold with an extended licence`);
          unitPrice = product.extendedPrice;
        } else unitPrice = product.salePrice ?? product.price;

        const licenseLabel = item.licenseType === "EXTENDED" ? "Extended" : "Single";
        return {
          productId: product.id,
          title: `${product.title} (${licenseLabel} licence)`,
          licenseType: product.isFree ? "SINGLE" : item.licenseType,
          unitPrice: roundMoney(unitPrice),
          discount: 0,
          total: roundMoney(unitPrice),
        };
      }

      const plan = planById.get(item.planId!);
      if (!plan) throw AppError.notFound("This pricing plan is not available");
      return {
        pricingPlanId: plan.id,
        title: `${plan.title} plan`,
        licenseType: "SINGLE" as LicenseType,
        unitPrice: roundMoney(plan.price),
        discount: 0,
        total: roundMoney(plan.price),
      };
    });
  }

  async createCheckout(input: CheckoutInput, user?: CheckoutUser) {
    const email = user?.email ?? input.customer.email;
    if (!email) throw AppError.badRequest("An email address is required to receive your licence");
    const name = user?.fullName ?? input.customer.name ?? email.split("@")[0];

    const items = await this.priceItems(input.items);
    const subtotal = roundMoney(items.reduce((sum, item) => sum + item.unitPrice, 0));
    const discountTotal = roundMoney(items.reduce((sum, item) => sum + item.discount, 0));
    const totalAmount = roundMoney(subtotal - discountTotal);
    const provider: PaymentProvider = totalAmount === 0 ? "FREE" : input.gateway === "sslcommerz" ? "SSLCOMMERZ" : "STRIPE";

    const productItems = items.filter((item) => item.productId);
    const planItems = items.filter((item) => item.pricingPlanId);

    const order = await prisma.orderInvoice.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: user?.id ?? null,
        // Legacy single-product columns, still read by the old dashboards
        templateId: items.length === 1 ? productItems[0]?.productId : null,
        pricingPlanId: items.length === 1 ? planItems[0]?.pricingPlanId : null,
        licenseType: productItems[0]?.licenseType ?? "SINGLE",
        status: "PENDING",
        subtotal,
        discountTotal,
        totalAmount,
        currency: "USD",
        provider,
        paymentMethod: gatewayLabels[provider],
        customerEmail: email,
        customerName: name,
        billingAddress: { email, name, ...(input.customer.phone ? { phone: input.customer.phone } : {}) },
        downloadLinks: [],
        items: { create: items },
        ...(provider === "FREE" ? { chargeAmount: 0, chargeCurrency: "USD" } : {}),
      },
      include: { items: true },
    });

    const urls = checkoutReturnUrls(order.id);

    if (provider === "FREE") {
      await fulfillmentService.fulfillOrder(order.id, { provider: "FREE", amount: 0, currency: "USD" });
      return { checkoutUrl: urls.success, orderId: order.id, orderNumber: order.orderNumber, gateway: "free", productTitle: items[0].title };
    }

    let session: GatewaySession;
    try {
      const gateway = provider === "SSLCOMMERZ" ? sslcommerzGateway : stripeGateway;
      session = await gateway.createSession(order, { email, name, phone: input.customer.phone });
    } catch (error) {
      await fulfillmentService.markFailed(order.id, error instanceof Error ? error.message : "Gateway error");
      if (error instanceof AppError) throw error;
      console.error("Payment gateway error:", error);
      throw new AppError(502, "The payment gateway is unavailable. Please try again in a moment");
    }

    await prisma.orderInvoice.update({
      where: { id: order.id },
      data: { providerSessionId: session.sessionId, chargeAmount: session.chargeAmount, chargeCurrency: session.chargeCurrency },
    });

    return {
      checkoutUrl: session.url,
      orderId: order.id,
      orderNumber: order.orderNumber,
      gateway: provider.toLowerCase(),
      chargeAmount: session.chargeAmount,
      chargeCurrency: session.chargeCurrency,
      productTitle: items[0].title,
    };
  }

  // Maps the old single-product request shape onto the cart checkout
  createLegacyCheckout(input: LegacyCheckoutInput, user?: CheckoutUser) {
    return this.createCheckout(
      {
        items: [
          input.productType === "plan"
            ? { planId: input.productId, licenseType: "SINGLE" }
            : { productId: input.productId, licenseType: "SINGLE" },
        ],
        gateway: input.gateway === "sslcommerz" ? "sslcommerz" : "stripe",
        customer: { email: input.customerEmail, name: input.customerName },
      },
      user
    );
  }

  // Admin-recorded offline sale (bank transfer, invoice, gift): fulfilled immediately
  async createManualOrder(input: {
    productId?: string;
    planId?: string;
    licenseType: LicenseType;
    customerEmail: string;
    customerName?: string;
    totalAmount?: number;
    paymentMethod?: string;
  }) {
    const [item] = await this.priceItems([
      input.planId ? { planId: input.planId, licenseType: "SINGLE" } : { productId: input.productId, licenseType: input.licenseType },
    ]);
    const totalAmount = roundMoney(input.totalAmount ?? item.total);
    const email = input.customerEmail.trim().toLowerCase();

    const order = await prisma.orderInvoice.create({
      data: {
        orderNumber: generateOrderNumber(),
        templateId: item.productId ?? null,
        pricingPlanId: item.pricingPlanId ?? null,
        licenseType: item.licenseType,
        status: "PENDING",
        subtotal: item.unitPrice,
        discountTotal: roundMoney(Math.max(0, item.unitPrice - totalAmount)),
        totalAmount,
        currency: "USD",
        provider: "MANUAL",
        paymentMethod: input.paymentMethod || gatewayLabels.MANUAL,
        chargeAmount: totalAmount,
        chargeCurrency: "USD",
        customerEmail: email,
        customerName: input.customerName ?? email.split("@")[0],
        downloadLinks: [],
        items: { create: [{ ...item, discount: roundMoney(Math.max(0, item.unitPrice - totalAmount)), total: totalAmount }] },
      },
    });
    await fulfillmentService.fulfillOrder(order.id, { provider: "MANUAL", amount: totalAmount, currency: "USD" });
    return order;
  }

  // Public, minimal view for the success / failed pages (no customer details)
  async getOrderStatus(orderId: string) {
    const order = await prisma.orderInvoice.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        currency: true,
        chargeAmount: true,
        chargeCurrency: true,
        provider: true,
        paidAt: true,
        failureReason: true,
        createdAt: true,
        items: {
          select: {
            title: true,
            licenseType: true,
            total: true,
            product: { select: { id: true, slug: true, imageUrl: true } },
            pricingPlan: { select: { id: true, slug: true } },
          },
        },
      },
    });
    if (!order) throw AppError.notFound("Order not found");
    return order;
  }
}

export const checkoutService = new CheckoutService();
