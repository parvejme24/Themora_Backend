import crypto from "node:crypto";
import { BillingInterval, Coupon, LicenseType, PaymentProvider } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/AppError";
import { activeSalePrice } from "../../utils/pricing";
import { couponService } from "../coupon/coupon.service";
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

export interface PricedItem {
  productId?: string;
  pricingPlanId?: string;
  categoryId?: string | null;
  billingInterval?: BillingInterval;
  title: string;
  licenseType: LicenseType;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface Quote {
  items: PricedItem[];
  subtotal: number;
  discountTotal: number;
  totalAmount: number;
  coupon: Coupon | null;
  isSubscription: boolean;
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

// Order item columns only (drops pricing-only fields)
const toOrderItem = ({ categoryId, billingInterval, ...item }: PricedItem) => item;

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
        select: { id: true, title: true, price: true, salePrice: true, saleEndsAt: true, extendedPrice: true, isFree: true, categoryId: true },
      }),
      prisma.pricingPlan.findMany({
        where: { id: { in: planIds }, isActive: true },
        select: { id: true, title: true, price: true, billingInterval: true },
      }),
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
        } else unitPrice = activeSalePrice(product) ?? product.price;

        const licenseLabel = item.licenseType === "EXTENDED" ? "Extended" : "Single";
        return {
          productId: product.id,
          categoryId: product.categoryId,
          title: `${product.title} (${licenseLabel} licence)`,
          licenseType: product.isFree ? "SINGLE" : item.licenseType,
          unitPrice: roundMoney(unitPrice),
          discount: 0,
          total: roundMoney(unitPrice),
        };
      }

      const plan = planById.get(item.planId!);
      if (!plan) throw AppError.notFound("This pricing plan is not available");
      const intervalLabel = plan.billingInterval === "MONTH" ? " (monthly)" : plan.billingInterval === "YEAR" ? " (yearly)" : "";
      return {
        pricingPlanId: plan.id,
        billingInterval: plan.billingInterval,
        title: `${plan.title} plan${intervalLabel}`,
        licenseType: "SINGLE" as LicenseType,
        unitPrice: roundMoney(plan.price),
        discount: 0,
        total: roundMoney(plan.price),
      };
    });
  }

  // Prices the cart and applies a coupon. Shared by checkout, the cart page
  // and the coupon preview, so all three always agree.
  async quote(items: CheckoutInput["items"], couponCode: string | undefined, customer: { userId?: string | null; email?: string }) {
    const priced = await this.priceItems(items);
    const isSubscription = priced.some((item) => item.billingInterval && item.billingInterval !== "ONE_TIME");
    if (isSubscription && priced.length > 1) {
      throw AppError.badRequest("Subscriptions must be bought on their own, not together with other items");
    }

    let coupon: Coupon | null = null;
    if (couponCode) {
      if (isSubscription) throw AppError.badRequest("Coupons cannot be used on subscriptions");
      if (!customer.email) throw AppError.badRequest("An email address is required to use a coupon");
      const result = await couponService.evaluate(couponCode, priced, { userId: customer.userId, email: customer.email });
      coupon = result.coupon;
      priced.forEach((item, i) => {
        item.discount = result.itemDiscounts[i];
        item.total = roundMoney(item.unitPrice - item.discount);
      });
    }

    const subtotal = roundMoney(priced.reduce((sum, item) => sum + item.unitPrice, 0));
    const discountTotal = roundMoney(priced.reduce((sum, item) => sum + item.discount, 0));
    return { items: priced, subtotal, discountTotal, totalAmount: roundMoney(subtotal - discountTotal), coupon, isSubscription } satisfies Quote;
  }

  async createCheckout(input: CheckoutInput, user?: CheckoutUser) {
    const email = user?.email ?? input.customer.email;
    if (!email) throw AppError.badRequest("An email address is required to receive your licence");
    const name = user?.fullName ?? input.customer.name ?? email.split("@")[0];

    const quote = await this.quote(input.items, input.couponCode, { userId: user?.id, email });
    if (quote.isSubscription && !user) throw AppError.unauthorized("Please sign in to subscribe");

    const { items, subtotal, discountTotal, totalAmount, coupon } = quote;
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
        couponId: coupon?.id ?? null,
        couponCode: coupon?.code ?? null,
        customerEmail: email,
        customerName: name,
        billingAddress: { email, name, ...(input.customer.phone ? { phone: input.customer.phone } : {}) },
        downloadLinks: [],
        items: { create: items.map(toOrderItem) },
        ...(provider === "FREE" ? { chargeAmount: 0, chargeCurrency: "USD" } : {}),
      },
      include: { items: true },
    });

    const recurring = planItems[0]?.billingInterval;
    return this.startPayment(order, provider, { email, name, phone: input.customer.phone }, {
      recurring: recurring === "MONTH" ? "month" : recurring === "YEAR" ? "year" : undefined,
      userId: user?.id,
      planId: planItems[0]?.pricingPlanId,
    });
  }

  // Free orders are fulfilled at once; paid orders get a gateway session
  private async startPayment(
    order: { id: string; orderNumber: string; totalAmount: number; items: { title: string; total: number }[] },
    provider: PaymentProvider,
    customer: { email: string; name: string; phone?: string },
    stripeOptions: { recurring?: "month" | "year"; userId?: string; planId?: string } = {}
  ) {
    const urls = checkoutReturnUrls(order.id);
    const productTitle = order.items[0]?.title;

    if (provider === "FREE") {
      await fulfillmentService.fulfillOrder(order.id, { provider: "FREE", amount: 0, currency: "USD" });
      return { checkoutUrl: urls.success, orderId: order.id, orderNumber: order.orderNumber, gateway: "free", productTitle };
    }

    let session: GatewaySession;
    try {
      session =
        provider === "SSLCOMMERZ"
          ? await sslcommerzGateway.createSession(order, customer)
          : await stripeGateway.createSession(order, { email: customer.email, name: customer.name }, stripeOptions);
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
      productTitle,
    };
  }

  /**
   * Single → Extended licence upgrade: the buyer pays the difference between
   * the extended price and what they paid. On payment the existing licence
   * is upgraded in place (same key).
   */
  async createUpgradeCheckout(user: CheckoutUser, licenseId: string, gateway: "stripe" | "sslcommerz", phone?: string) {
    const license = await prisma.license.findFirst({
      where: { id: licenseId, userId: user.id },
      include: {
        template: { select: { id: true, title: true, price: true, salePrice: true, saleEndsAt: true, extendedPrice: true, status: true } },
        orderItem: { select: { total: true } },
      },
    });
    if (!license) throw AppError.notFound("Licence not found");
    if (!license.isActive) throw AppError.badRequest("This licence is no longer active");
    if (license.licenseType === "EXTENDED") throw AppError.badRequest("This licence is already extended");
    const product = license.template;
    if (product.extendedPrice == null || product.status !== "PUBLISHED") {
      throw AppError.badRequest("This product does not offer an extended licence");
    }

    const paid = license.orderItem?.total ?? activeSalePrice(product) ?? product.price;
    const price = roundMoney(Math.max(product.extendedPrice - paid, 0));
    const provider: PaymentProvider = price === 0 ? "FREE" : gateway === "sslcommerz" ? "SSLCOMMERZ" : "STRIPE";

    const order = await prisma.orderInvoice.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: user.id,
        templateId: product.id,
        licenseType: "EXTENDED",
        status: "PENDING",
        subtotal: price,
        totalAmount: price,
        currency: "USD",
        provider,
        paymentMethod: gatewayLabels[provider],
        customerEmail: user.email,
        customerName: user.fullName,
        downloadLinks: [],
        items: {
          create: [{
            productId: product.id,
            title: `${product.title} (upgrade to Extended licence)`,
            licenseType: "EXTENDED",
            unitPrice: price,
            total: price,
            upgradesLicenseId: license.id,
          }],
        },
        ...(provider === "FREE" ? { chargeAmount: 0, chargeCurrency: "USD" } : {}),
      },
      include: { items: true },
    });
    return { ...(await this.startPayment(order, provider, { email: user.email, name: user.fullName, phone })), upgradePrice: price };
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
    const discount = roundMoney(Math.max(0, item.unitPrice - totalAmount));
    const email = input.customerEmail.trim().toLowerCase();

    const order = await prisma.orderInvoice.create({
      data: {
        orderNumber: generateOrderNumber(),
        templateId: item.productId ?? null,
        pricingPlanId: item.pricingPlanId ?? null,
        licenseType: item.licenseType,
        status: "PENDING",
        subtotal: item.unitPrice,
        discountTotal: discount,
        totalAmount,
        currency: "USD",
        provider: "MANUAL",
        paymentMethod: input.paymentMethod || gatewayLabels.MANUAL,
        chargeAmount: totalAmount,
        chargeCurrency: "USD",
        customerEmail: email,
        customerName: input.customerName ?? email.split("@")[0],
        downloadLinks: [],
        items: { create: [{ ...toOrderItem(item), discount, total: totalAmount }] },
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
        subtotal: true,
        discountTotal: true,
        totalAmount: true,
        currency: true,
        couponCode: true,
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
            unitPrice: true,
            discount: true,
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
