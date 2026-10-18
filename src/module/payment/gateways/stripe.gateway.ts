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
  async createSession(order: GatewayOrder, customer: GatewayCustomer): Promise<GatewaySession> {
    const urls = checkoutReturnUrls(order.id);
    const session = await getClient().checkout.sessions.create({
      mode: "payment",
      customer_email: customer.email,
      client_reference_id: order.id,
      line_items: order.items.map((item) => ({
        quantity: 1,
        price_data: { currency: "usd", unit_amount: toCents(item.total), product_data: { name: item.title } },
      })),
      metadata: { orderId: order.id, orderNumber: order.orderNumber },
      payment_intent_data: { metadata: { orderId: order.id, orderNumber: order.orderNumber } },
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

  async refund(paymentIntentId: string) {
    return getClient().refunds.create({ payment_intent: paymentIntentId });
  },

  fromCents(amount: number | null | undefined) {
    return (amount ?? 0) / 100;
  },
};
