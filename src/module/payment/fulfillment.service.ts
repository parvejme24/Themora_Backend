import crypto from "node:crypto";
import { OrderStatus, PaymentProvider, Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/AppError";

export const generateLicenseKey = () =>
  ["THMR", ...Array.from({ length: 3 }, () => crypto.randomBytes(2).toString("hex").toUpperCase())].join("-");

export interface ConfirmedPayment {
  provider: PaymentProvider;
  providerPaymentId?: string | null;
  amount: number;
  currency: string;
}

// Orders in these states can still become paid (an expired Stripe session or
// a failed first attempt can be followed by a successful payment)
const PAYABLE_STATUSES: OrderStatus[] = ["PENDING", "PROCESSING", "FAILED", "CANCELLED"];

const amountsMatch = (expected: number | null, received: number) =>
  expected !== null && Math.abs(expected - received) < 0.01;

export class FulfillmentService {
  /**
   * Marks an order paid and issues licences / plan entitlements.
   * Idempotent: safe to call from webhooks, IPNs and return redirects at the
   * same time. Only the first call does the work.
   */
  async fulfillOrder(orderId: string, payment: ConfirmedPayment) {
    const order = await prisma.orderInvoice.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw AppError.notFound("Order not found");
    if (order.status === "COMPLETED") return { fulfilled: false, reason: "already_completed" as const, orderId };
    if (order.status === "REFUNDED") return { fulfilled: false, reason: "refunded" as const, orderId };

    if (
      payment.currency.toUpperCase() !== (order.chargeCurrency ?? "").toUpperCase() ||
      !amountsMatch(order.chargeAmount, payment.amount)
    ) {
      const reason = `Payment amount mismatch: expected ${order.chargeAmount} ${order.chargeCurrency}, received ${payment.amount} ${payment.currency}`;
      await this.markFailed(order.id, reason);
      return { fulfilled: false, reason: "amount_mismatch" as const, orderId };
    }

    return prisma.$transaction(async (tx) => {
      // Row-level guard: a concurrent call blocks here and then matches 0 rows
      const claimed = await tx.orderInvoice.updateMany({
        where: { id: order.id, status: { in: PAYABLE_STATUSES } },
        data: {
          status: "COMPLETED",
          paidAt: new Date(),
          provider: payment.provider,
          providerPaymentId: payment.providerPaymentId ?? undefined,
          failureReason: null,
        },
      });
      if (claimed.count === 0) return { fulfilled: false, reason: "already_completed" as const, orderId };

      const userId =
        order.userId ??
        (await tx.user.findUnique({ where: { email: order.customerEmail }, select: { id: true } }))?.id ??
        null;
      if (userId && !order.userId) {
        await tx.orderInvoice.update({ where: { id: order.id }, data: { userId } });
      }

      const licenseIds: string[] = [];
      for (const item of order.items) {
        if (item.productId) {
          const license = await tx.license.create({
            data: {
              orderId: order.id,
              orderItemId: item.id,
              templateId: item.productId,
              userId,
              licenseType: item.licenseType,
              licenseKey: generateLicenseKey(),
              maxUsage: item.licenseType === "SINGLE" ? 1 : null,
              activationLimit: item.licenseType === "SINGLE" ? 1 : null,
            },
          });
          licenseIds.push(license.id);
          await tx.template.update({ where: { id: item.productId }, data: { totalPurchase: { increment: 1 } } });
        }

        if (item.pricingPlanId) {
          const plan = await tx.pricingPlan.findUnique({ where: { id: item.pricingPlanId } });
          if (plan) {
            const supportExpiresAt = new Date();
            supportExpiresAt.setFullYear(supportExpiresAt.getFullYear() + 1);
            await tx.planEntitlement.upsert({
              where: { orderId: order.id },
              create: {
                pricingPlanId: plan.id,
                orderId: order.id,
                userId,
                customerEmail: order.customerEmail,
                websitesAllowed: plan.websiteLimit,
                supportExpiresAt,
              },
              update: { isActive: true, userId },
            });
          }
        }
      }

      return { fulfilled: true, reason: "paid" as const, orderId, licenseIds };
    });
  }

  async markFailed(orderId: string, reason: string) {
    await prisma.orderInvoice.updateMany({
      where: { id: orderId, status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "FAILED", failureReason: reason.slice(0, 500) },
    });
  }

  async markCancelled(orderId: string, reason = "Checkout was cancelled") {
    await prisma.orderInvoice.updateMany({
      where: { id: orderId, status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "CANCELLED", failureReason: reason },
    });
  }

  // Payment received but flagged by the gateway; an admin must review it
  async markOnHold(orderId: string, reason: string) {
    await prisma.orderInvoice.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status: "PROCESSING", failureReason: reason },
    });
  }

  async markRefunded(orderId: string) {
    const order = await prisma.orderInvoice.findUnique({ where: { id: orderId }, select: { status: true } });
    if (!order || order.status === "REFUNDED") return false;
    await prisma.$transaction([
      prisma.orderInvoice.update({ where: { id: orderId }, data: { status: "REFUNDED" } }),
      prisma.license.updateMany({ where: { orderId }, data: { isActive: false } }),
      prisma.planEntitlement.updateMany({ where: { orderId }, data: { isActive: false } }),
    ]);
    return true;
  }

  /**
   * Stores each webhook once. Returns false when the event was already
   * processed, so retries from the gateway are acknowledged without work.
   */
  async recordWebhookEvent(provider: PaymentProvider, eventId: string, type: string, payload: unknown) {
    try {
      await prisma.webhookEvent.create({
        data: { provider, eventId, type, payload: payload as Prisma.InputJsonValue },
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await prisma.webhookEvent.findUnique({
          where: { provider_eventId: { provider, eventId } },
          select: { processedAt: true },
        });
        return !existing?.processedAt;
      }
      throw error;
    }
  }

  async completeWebhookEvent(provider: PaymentProvider, eventId: string, error?: string) {
    await prisma.webhookEvent.update({
      where: { provider_eventId: { provider, eventId } },
      data: error ? { error: error.slice(0, 1000) } : { processedAt: new Date(), error: null },
    });
  }
}

export const fulfillmentService = new FulfillmentService();
