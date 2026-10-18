import Stripe from "stripe";
import { env } from "../../../config/env";
import { AppError } from "../../../utils/AppError";
import { checkoutReturnUrls } from "../payment.urls";
import { GatewayCustomer, GatewayOrder, GatewaySession } from "./gateway.types";

let client: Stripe | null = null;

const getClient = () => {
  if (!env.STRIPE_SECRET_KEY) throw new AppError(503, "Card payments (Stripe) are not configured yet");
  client ??= new Stripe(env.STRIPE_SECRET_KEY);
  return client;
};

const toCents = (amount: number) => Math.round(amount * 100);

export const stripeGateway = {
  async createSession(
    order: GatewayOrder,
    customer: GatewayCustomer,
    options: { recurring?: "month" | "year"; userId?: string; planId?: string } = {}
  ): Promise<GatewaySession> {
    const urls = checkoutReturnUrls(order.id);
    const metadata = { orderId: order.id, orderNumber: order.orderNumber };
    const session = await getClient().checkout.sessions.create({
      mode: options.recurring ? "subscription" : "payment",
      customer_email: customer.email,
      client_reference_id: order.id,
      line_items: order.items.map((item) => ({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: toCents(item.total),
          product_data: { name: item.title },
          ...(options.recurring ? { recurring: { interval: options.recurring } } : {}),
        },
      })),
      metadata,
      ...(options.recurring
        ? { subscription_data: { metadata: { ...metadata, userId: options.userId ?? "", planId: options.planId ?? "" } } }
        : { payment_intent_data: { metadata } }),
      success_url: `${urls.success}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: urls.cancelled,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });
    if (!session.url) throw new AppError(502, "Stripe did not return a checkout URL");
    return { url: session.url, sessionId: session.id, chargeAmount: order.totalAmount, chargeCurrency: "USD" };
  },

  retrieveSession(sessionId: string) {
    return getClient().checkout.sessions.retrieve(sessionId);
  },

  // Throws if the signature does not match STRIPE_WEBHOOK_SECRET
  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    if (!env.STRIPE_WEBHOOK_SECRET) throw new AppError(503, "Stripe webhooks are not configured");
    return Stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  },

  setCancelAtPeriodEnd(subscriptionId: string, cancel: boolean) {
    return getClient().subscriptions.update(subscriptionId, { cancel_at_period_end: cancel });
  },

  async createPortalSession(customerId: string, returnUrl: string) {
    const session = await getClient().billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
    return session.url;
  },

  // Accepts a payment intent (one-time orders) or an invoice (subscriptions)
  async refund(paymentId: string) {
    let paymentIntent = paymentId;
    if (paymentId.startsWith("in_")) {
      const invoice: any = await getClient().invoices.retrieve(paymentId);
      const fromInvoice = invoice.payment_intent ?? invoice.payments?.data?.[0]?.payment?.payment_intent;
      paymentIntent = typeof fromInvoice === "string" ? fromInvoice : fromInvoice?.id;
      if (!paymentIntent) throw new AppError(502, "Could not find the Stripe payment for this invoice");
    }
    return getClient().refunds.create({ payment_intent: paymentIntent });
  },

  cancelSubscription(subscriptionId: string) {
    return getClient().subscriptions.cancel(subscriptionId);
  },

  fromCents(amount: number | null | undefined) {
    return (amount ?? 0) / 100;
  },
};
