import { Request, Response } from "express";
import Stripe from "stripe";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/AppError";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { checkoutService } from "./checkout.service";
import { fulfillmentService } from "./fulfillment.service";
import { sslcommerzGateway } from "./gateways/sslcommerz.gateway";
import { stripeGateway } from "./gateways/stripe.gateway";
import { checkoutReturnUrls } from "./payment.urls";
import { subscriptionService } from "../subscription/subscription.service";

const checkoutUser = (req: Request) => {
  const user = (req as any).user;
  if (user && (user.isBanned || user.isTrashed || user.isDeletedPermanently)) {
    throw AppError.forbidden("This account cannot make purchases");
  }
  return user;
};

export const createCheckout = asyncHandler(async (req: Request, res: Response) => {
  const result = await checkoutService.createCheckout((req as any).validatedData, checkoutUser(req));
  sendResponse(res, { statusCode: 201, message: "Checkout created", data: result });
});

export const createLegacyCheckout = asyncHandler(async (req: Request, res: Response) => {
  const result = await checkoutService.createLegacyCheckout((req as any).validatedData, checkoutUser(req));
  sendResponse(res, { statusCode: 201, message: "Checkout created", data: result });
});

export const getOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const order = await checkoutService.getOrderStatus(req.params.id);
  sendResponse(res, { message: "Order status fetched", data: order });
});

// ── Stripe ─────────────────────────────────────────────────────────────

const fulfillStripeSession = async (session: Stripe.Checkout.Session) => {
  const orderId = session.metadata?.orderId ?? session.client_reference_id;
  if (!orderId) return { fulfilled: false, reason: "no_order" };
  if (session.payment_status !== "paid") return { fulfilled: false, reason: "not_paid" };
  return fulfillmentService.fulfillOrder(orderId, {
    provider: "STRIPE",
    providerPaymentId:
      (typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id) ??
      (typeof session.invoice === "string" ? session.invoice : session.invoice?.id),
    amount: stripeGateway.fromCents(session.amount_total),
    currency: session.currency ?? "",
    subscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id,
    customerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
  });
};

const handleStripeEvent = async (event: Stripe.Event) => {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return fulfillStripeSession(event.data.object);
    case "checkout.session.async_payment_failed": {
      const orderId = event.data.object.metadata?.orderId;
      if (orderId) await fulfillmentService.markFailed(orderId, "Payment failed");
      return;
    }
    case "checkout.session.expired": {
      const orderId = event.data.object.metadata?.orderId;
      if (orderId) await fulfillmentService.markCancelled(orderId, "Checkout session expired");
      return;
    }
    case "charge.refunded": {
      const charge = event.data.object;
      const paymentIntent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (!paymentIntent || charge.amount_refunded < charge.amount) return; // partial refunds are handled manually
      const order = await prisma.orderInvoice.findFirst({ where: { providerPaymentId: paymentIntent }, select: { id: true } });
      if (order) await fulfillmentService.markRefunded(order.id);
      return;
    }
    case "invoice.paid":
      return subscriptionService.handleInvoicePaid(event.data.object);
    case "invoice.payment_failed":
      return subscriptionService.handleInvoicePaymentFailed(event.data.object);
    case "customer.subscription.updated":
      return subscriptionService.handleSubscriptionUpdated(event.data.object);
    case "customer.subscription.deleted":
      return subscriptionService.handleSubscriptionDeleted(event.data.object);
    default:
      return;
  }
};

export const stripeWebhook = async (req: Request, res: Response) => {
  let event: Stripe.Event;
  try {
    const rawBody = (req as any).rawBody as Buffer | undefined;
    event = stripeGateway.constructEvent(rawBody ?? Buffer.from(""), String(req.headers["stripe-signature"] ?? ""));
  } catch (error) {
    const status = error instanceof AppError ? error.statusCode : 400;
    return res.status(status).json({ success: false, message: "Invalid Stripe signature" });
  }

  const isNew = await fulfillmentService.recordWebhookEvent("STRIPE", event.id, event.type, event);
  if (!isNew) return res.json({ received: true, duplicate: true });

  try {
    await handleStripeEvent(event);
    await fulfillmentService.completeWebhookEvent("STRIPE", event.id);
    return res.json({ received: true });
  } catch (error) {
    console.error(`Stripe webhook ${event.type} failed:`, error);
    await fulfillmentService.completeWebhookEvent("STRIPE", event.id, error instanceof Error ? error.message : "Unknown error");
    // 500 makes Stripe retry later
    return res.status(500).json({ received: false });
  }
};

// Called by the success page with ?session_id=..., so buyers get their
// licence immediately even if the webhook is delayed (or not set up locally)
export const confirmStripeSession = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = (req as any).validatedData;
  const session = await stripeGateway.retrieveSession(sessionId);
  const orderId = session.metadata?.orderId ?? session.client_reference_id;
  if (!orderId) throw AppError.notFound("Order not found for this session");

  await fulfillStripeSession(session);
  const order = await checkoutService.getOrderStatus(orderId);
  sendResponse(res, { message: "Payment status confirmed", data: order });
});

// ── SSLCommerz ─────────────────────────────────────────────────────────

const findOrderByTranId = (tranId: string | undefined) =>
  tranId ? prisma.orderInvoice.findUnique({ where: { orderNumber: tranId }, select: { id: true } }) : null;

// Validates a payment with SSLCommerz and fulfils the order. Used by both the
// IPN (server-to-server) and the success redirect (browser).
const verifySslcommerzPayment = async (valId: string | undefined, tranId: string | undefined) => {
  const order = await findOrderByTranId(tranId);
  if (!order) return { orderId: null, outcome: "unknown_order" as const };
  if (!valId) return { orderId: order.id, outcome: "invalid" as const };

  const validation = await sslcommerzGateway.validate(valId);
  const valid = ["VALID", "VALIDATED"].includes(validation.status) && validation.tran_id === tranId;
  if (!valid) {
    await fulfillmentService.markFailed(order.id, `SSLCommerz validation status: ${validation.status}`);
    return { orderId: order.id, outcome: "invalid" as const };
  }
  if (validation.risk_level === "1") {
    await fulfillmentService.markOnHold(order.id, "Payment flagged as risky by SSLCommerz; awaiting manual review");
    return { orderId: order.id, outcome: "on_hold" as const };
  }

  await fulfillmentService.fulfillOrder(order.id, {
    provider: "SSLCOMMERZ",
    providerPaymentId: validation.bank_tran_id ?? validation.val_id,
    amount: Number(validation.currency_amount),
    currency: validation.currency_type,
  });
  return { orderId: order.id, outcome: "paid" as const };
};

export const sslcommerzIpn = async (req: Request, res: Response) => {
  const { val_id: valId, tran_id: tranId, status } = req.body ?? {};
  const eventId = valId || `${tranId}:${status}`;
  try {
    const isNew = await fulfillmentService.recordWebhookEvent("SSLCOMMERZ", String(eventId), String(status ?? "IPN"), req.body);
    if (!isNew) return res.json({ received: true, duplicate: true });

    if (status === "VALID" || status === "VALIDATED") {
      await verifySslcommerzPayment(valId, tranId);
    } else {
      const order = await findOrderByTranId(tranId);
      if (order && status === "FAILED") await fulfillmentService.markFailed(order.id, "Payment failed at SSLCommerz");
      if (order && status === "CANCELLED") await fulfillmentService.markCancelled(order.id);
    }
    await fulfillmentService.completeWebhookEvent("SSLCOMMERZ", String(eventId));
    return res.json({ received: true });
  } catch (error) {
    console.error("SSLCommerz IPN failed:", error);
    return res.status(500).json({ received: false });
  }
};

// SSLCommerz posts the browser back to these URLs; we verify, then redirect
// to the frontend
export const sslcommerzSuccess = async (req: Request, res: Response) => {
  const { val_id: valId, tran_id: tranId } = req.body ?? {};
  try {
    const { orderId, outcome } = await verifySslcommerzPayment(valId, tranId);
    if (!orderId) return res.redirect(303, checkoutReturnUrls("unknown").failed);
    const urls = checkoutReturnUrls(orderId);
    return res.redirect(303, outcome === "invalid" ? urls.failed : urls.success);
  } catch (error) {
    console.error("SSLCommerz success callback failed:", error);
    const order = await findOrderByTranId(tranId);
    return res.redirect(303, order ? checkoutReturnUrls(order.id).success : checkoutReturnUrls("unknown").failed);
  }
};

export const sslcommerzFail = async (req: Request, res: Response) => {
  const order = await findOrderByTranId(req.body?.tran_id);
  if (order) await fulfillmentService.markFailed(order.id, req.body?.error || "Payment failed at SSLCommerz");
  return res.redirect(303, checkoutReturnUrls(order?.id ?? "unknown").failed);
};

export const sslcommerzCancel = async (req: Request, res: Response) => {
  const order = await findOrderByTranId(req.body?.tran_id);
  if (order) await fulfillmentService.markCancelled(order.id);
  return res.redirect(303, checkoutReturnUrls(order?.id ?? "unknown").cancelled);
};
