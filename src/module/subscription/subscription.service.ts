import { Prisma, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { buildPaginationMeta } from "../../utils/pagination";
import { generateOrderNumber } from "../payment/checkout.service";
import { stripeGateway } from "../payment/gateways/stripe.gateway";

const planSelect = { id: true, slug: true, title: true, price: true, billingInterval: true, grantsAllAccess: true } as const;

// Stripe moved some fields between API versions; read both shapes
const invoiceSubscriptionId = (invoice: any): string | undefined =>
  (typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id) ??
  invoice.parent?.subscription_details?.subscription;

const subscriptionPeriodEnd = (subscription: any): number | undefined =>
  subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end;

const mapStripeStatus = (status: string): SubscriptionStatus => {
  if (status === "active" || status === "trialing") return "ACTIVE";
  if (status === "past_due" || status === "unpaid" || status === "incomplete") return "PAST_DUE";
  if (status === "incomplete_expired") return "EXPIRED";
  return "CANCELLED";
};

export class SubscriptionService {
  // Active subscription to a plan that unlocks every product
  async hasAllAccess(userId: string) {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ["ACTIVE", "PAST_DUE"] },
        currentPeriodEnd: { gt: new Date() },
        pricingPlan: { grantsAllAccess: true },
      },
      select: { id: true },
    });
    return Boolean(subscription);
  }

  async getForUser(userId: string) {
    const subscription = await prisma.subscription.findFirst({
      where: { userId },
      orderBy: [{ currentPeriodEnd: "desc" }],
      include: { pricingPlan: { select: planSelect } },
    });
    if (!subscription) return null;
    const isActive = ["ACTIVE", "PAST_DUE"].includes(subscription.status) && subscription.currentPeriodEnd > new Date();
    return { ...subscription, isActive, canManageBilling: subscription.provider === "STRIPE" && !!subscription.providerCustomerId };
  }

  private async findManageable(userId: string) {
    const subscription = await prisma.subscription.findFirst({
      where: { userId, status: { in: ["ACTIVE", "PAST_DUE"] } },
      orderBy: { currentPeriodEnd: "desc" },
    });
    if (!subscription) throw AppError.notFound("You do not have an active subscription");
    return subscription;
  }

  // Access continues until the end of the paid period
  async cancel(userId: string) {
    const subscription = await this.findManageable(userId);
    if (subscription.provider === "STRIPE" && subscription.providerSubscriptionId) {
      await stripeGateway.setCancelAtPeriodEnd(subscription.providerSubscriptionId, true);
    }
    return prisma.subscription.update({
      where: { id: subscription.id },
      data: { cancelAtPeriodEnd: true, autoRenew: false },
      include: { pricingPlan: { select: planSelect } },
    });
  }

  async resume(userId: string) {
    const subscription = await this.findManageable(userId);
    if (subscription.provider !== "STRIPE" || !subscription.providerSubscriptionId) {
      throw AppError.badRequest("This pass does not renew automatically. Buy another period before it ends to extend it");
    }
    await stripeGateway.setCancelAtPeriodEnd(subscription.providerSubscriptionId, false);
    return prisma.subscription.update({
      where: { id: subscription.id },
      data: { cancelAtPeriodEnd: false, autoRenew: true },
      include: { pricingPlan: { select: planSelect } },
    });
  }

  async billingPortal(userId: string) {
    const subscription = await prisma.subscription.findFirst({
      where: { userId, provider: "STRIPE", providerCustomerId: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    if (!subscription?.providerCustomerId) throw AppError.notFound("No card subscription to manage");
    return stripeGateway.createPortalSession(subscription.providerCustomerId, `${env.FRONTEND_URL.replace(/\/+$/, "")}/dashboard/subscription`);
  }

  async adminList(query: { status?: SubscriptionStatus; page: number; limit: number }) {
    const where: Prisma.SubscriptionWhereInput = query.status ? { status: query.status } : {};
    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { pricingPlan: { select: planSelect }, user: { select: { id: true, fullName: true, email: true } } },
      }),
      prisma.subscription.count({ where }),
    ]);
    return { subscriptions, pagination: buildPaginationMeta(total, query.page, query.limit) };
  }

  // ── Stripe webhooks ────────────────────────────────────────────────────

  // Renewal payments: extend the period and record an order for reporting
  async handleInvoicePaid(invoice: any) {
    if (invoice.billing_reason !== "subscription_cycle") return; // first payment is handled by checkout
    const subscriptionId = invoiceSubscriptionId(invoice);
    if (!subscriptionId) return;
    const subscription = await prisma.subscription.findUnique({
      where: { providerSubscriptionId: subscriptionId },
      include: { pricingPlan: true, user: { select: { email: true, fullName: true } } },
    });
    if (!subscription) return;

    const alreadyRecorded = await prisma.orderInvoice.findFirst({ where: { providerPaymentId: invoice.id }, select: { id: true } });
    const periodEnd = invoice.lines?.data?.[0]?.period?.end;
    const amount = (invoice.amount_paid ?? 0) / 100;

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: "ACTIVE",
          ...(periodEnd ? { currentPeriodEnd: new Date(periodEnd * 1000) } : {}),
          currentPeriodStart: new Date(),
          reminderSentAt: null,
        },
      });
      if (alreadyRecorded) return;
      await tx.orderInvoice.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId: subscription.userId,
          pricingPlanId: subscription.pricingPlanId,
          subscriptionId: subscription.id,
          status: "COMPLETED",
          licenseType: "SINGLE",
          subtotal: amount,
          totalAmount: amount,
          currency: "USD",
          provider: "STRIPE",
          providerPaymentId: invoice.id,
          chargeAmount: amount,
          chargeCurrency: "USD",
          paidAt: new Date(),
          paymentMethod: "Stripe (renewal)",
          customerEmail: subscription.user.email,
          customerName: subscription.user.fullName,
          downloadLinks: [],
          items: {
            create: [{ pricingPlanId: subscription.pricingPlanId, title: `${subscription.pricingPlan.title} plan (renewal)`, unitPrice: amount, total: amount }],
          },
        },
      });
    });
  }

  async handleInvoicePaymentFailed(invoice: any) {
    const subscriptionId = invoiceSubscriptionId(invoice);
    if (!subscriptionId) return;
    await prisma.subscription.updateMany({ where: { providerSubscriptionId: subscriptionId }, data: { status: "PAST_DUE" } });
  }

  async handleSubscriptionUpdated(stripeSubscription: any) {
    const periodEnd = subscriptionPeriodEnd(stripeSubscription);
    await prisma.subscription.updateMany({
      where: { providerSubscriptionId: stripeSubscription.id },
      data: {
        status: mapStripeStatus(stripeSubscription.status),
        cancelAtPeriodEnd: Boolean(stripeSubscription.cancel_at_period_end),
        autoRenew: !stripeSubscription.cancel_at_period_end && stripeSubscription.status !== "canceled",
        ...(periodEnd ? { currentPeriodEnd: new Date(periodEnd * 1000) } : {}),
      },
    });
  }

  async handleSubscriptionDeleted(stripeSubscription: any) {
    await prisma.subscription.updateMany({
      where: { providerSubscriptionId: stripeSubscription.id },
      data: { status: "CANCELLED", autoRenew: false, cancelAtPeriodEnd: false, currentPeriodEnd: new Date() },
    });
  }
}

export const subscriptionService = new SubscriptionService();
