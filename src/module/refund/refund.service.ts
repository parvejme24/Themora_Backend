import { Prisma, RefundRequestStatus } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { runInBackground } from "../../utils/background";
import { sendRefundDecisionEmail } from "../../utils/email";
import { buildPaginationMeta } from "../../utils/pagination";
import { fulfillmentService } from "../payment/fulfillment.service";
import { sslcommerzGateway } from "../payment/gateways/sslcommerz.gateway";
import { stripeGateway } from "../payment/gateways/stripe.gateway";

const requestInclude = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      totalAmount: true,
      chargeAmount: true,
      chargeCurrency: true,
      provider: true,
      paidAt: true,
      status: true,
      items: { select: { title: true, total: true } },
    },
  },
  user: { select: { id: true, fullName: true, email: true } },
  resolvedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.RefundRequestInclude;

export class RefundService {
  async request(user: { id: string; email: string }, orderId: string, reason: string) {
    const order = await prisma.orderInvoice.findFirst({
      where: { id: orderId, OR: [{ userId: user.id }, { customerEmail: user.email }] },
      select: { id: true, status: true, totalAmount: true, provider: true, paidAt: true, createdAt: true },
    });
    if (!order) throw AppError.notFound("Order not found");
    if (order.status !== "COMPLETED") throw AppError.badRequest("Only completed orders can be refunded");
    if (order.totalAmount <= 0 || order.provider === "FREE") throw AppError.badRequest("Free orders cannot be refunded");

    const paidAt = order.paidAt ?? order.createdAt;
    const deadline = new Date(paidAt.getTime() + env.REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    if (deadline < new Date()) {
      throw AppError.badRequest(`Refunds can be requested within ${env.REFUND_WINDOW_DAYS} days of purchase`);
    }

    const open = await prisma.refundRequest.findFirst({ where: { orderId, status: "REQUESTED" }, select: { id: true } });
    if (open) throw AppError.conflict("A refund request for this order is already being reviewed");

    return prisma.refundRequest.create({
      data: { orderId, userId: user.id, reason, amount: order.totalAmount },
      include: requestInclude,
    });
  }

  listMine(userId: string) {
    return prisma.refundRequest.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: requestInclude });
  }

  async adminList(query: { status?: RefundRequestStatus; page: number; limit: number }) {
    const where: Prisma.RefundRequestWhereInput = query.status ? { status: query.status } : {};
    const [requests, total] = await Promise.all([
      prisma.refundRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: requestInclude,
      }),
      prisma.refundRequest.count({ where }),
    ]);
    return { requests, pagination: buildPaginationMeta(total, query.page, query.limit) };
  }

  /**
   * Sends the money back through the original gateway, then revokes licences,
   * plan access and any subscription. Manual orders are refunded offline.
   */
  async approve(requestId: string, adminId: string, note?: string) {
    const request = await this.findOpen(requestId);
    const order = await prisma.orderInvoice.findUniqueOrThrow({
      where: { id: request.orderId },
      include: { subscription: { select: { id: true, provider: true, providerSubscriptionId: true } } },
    });

    let providerRefundId: string | null = null;
    try {
      if (order.provider === "STRIPE") {
        if (!order.providerPaymentId) throw new AppError(409, "This order has no Stripe payment reference");
        providerRefundId = (await stripeGateway.refund(order.providerPaymentId)).id;
        if (order.subscription?.providerSubscriptionId) {
          await stripeGateway.cancelSubscription(order.subscription.providerSubscriptionId);
        }
      } else if (order.provider === "SSLCOMMERZ") {
        if (!order.providerPaymentId || order.chargeAmount == null) throw new AppError(409, "This order has no SSLCommerz payment reference");
        const result = await sslcommerzGateway.refund(order.providerPaymentId, order.chargeAmount, request.reason);
        if (result.status !== "success") throw new AppError(502, `SSLCommerz refused the refund: ${result.errorReason || result.status || "unknown error"}`);
        providerRefundId = result.refund_ref_id ?? null;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gateway refund failed";
      await prisma.refundRequest.update({ where: { id: requestId }, data: { status: "FAILED", failureReason: message.slice(0, 500) } });
      throw error instanceof AppError ? error : new AppError(502, message);
    }

    await fulfillmentService.markRefunded(order.id);
    if (order.subscription) {
      await prisma.subscription.update({
        where: { id: order.subscription.id },
        data: { status: "CANCELLED", autoRenew: false, cancelAtPeriodEnd: false, currentPeriodEnd: new Date() },
      });
    }

    const updated = await prisma.refundRequest.update({
      where: { id: requestId },
      data: { status: "REFUNDED", providerRefundId, adminNote: note ?? null, resolvedById: adminId, resolvedAt: new Date() },
      include: requestInclude,
    });
    runInBackground("refund approved email", () =>
      sendRefundDecisionEmail(updated.user.email, updated.user.fullName, updated.order.orderNumber, true, note)
    );
    return updated;
  }

  async reject(requestId: string, adminId: string, note: string) {
    await this.findOpen(requestId);
    const updated = await prisma.refundRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED", adminNote: note, resolvedById: adminId, resolvedAt: new Date() },
      include: requestInclude,
    });
    runInBackground("refund rejected email", () =>
      sendRefundDecisionEmail(updated.user.email, updated.user.fullName, updated.order.orderNumber, false, note)
    );
    return updated;
  }

  // FAILED requests can be retried after fixing the cause
  private async findOpen(requestId: string) {
    const request = await prisma.refundRequest.findUnique({ where: { id: requestId } });
    if (!request) throw AppError.notFound("Refund request not found");
    if (request.status !== "REQUESTED" && request.status !== "FAILED") throw AppError.conflict("This refund request has already been resolved");
    return request;
  }
}

export const refundService = new RefundService();
