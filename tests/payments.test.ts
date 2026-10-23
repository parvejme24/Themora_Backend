import request from "supertest";
import Stripe from "stripe";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { env } from "../src/config/env";
import { fulfillmentService } from "../src/module/payment/fulfillment.service";
import { stripeGateway } from "../src/module/payment/gateways/stripe.gateway";
import { createTestAdmin, createTestUser, prisma, resetDatabase } from "./helpers/db";
import { createProduct } from "./helpers/factories";

const WEBHOOK_SECRET = "whsec_test_secret";
const originalEnv = { ...env };

beforeEach(async () => {
  await resetDatabase();
  Object.assign(env, originalEnv, {
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    SSLCOMMERZ_STORE_ID: "",
    SSLCOMMERZ_STORE_PASSWORD: "",
    USD_TO_BDT_RATE: 120,
    BACKEND_URL: "https://api.themora.test",
    FRONTEND_URL: "https://themora.test",
  });
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  Object.assign(env, originalEnv);
  await prisma.$disconnect();
});

const mockStripeSession = () =>
  vi.spyOn(stripeGateway, "createSession").mockImplementation(async (order) => ({
    url: `https://checkout.stripe.com/c/pay/cs_test_${order.orderNumber}`,
    sessionId: `cs_test_${order.orderNumber}`,
    chargeAmount: order.totalAmount,
    chargeCurrency: "USD",
  }));

const sendStripeEvent = (event: object) => {
  const payload = JSON.stringify(event);
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return request(app)
    .post("/api/v1/webhooks/stripe")
    .set("Content-Type", "application/json")
    .set("Stripe-Signature", signature)
    .send(payload);
};

const sessionCompletedEvent = (orderId: string, amountCents: number, id = `evt_${orderId.slice(0, 8)}`) => ({
  id,
  object: "event",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_1",
      object: "checkout.session",
      metadata: { orderId },
      client_reference_id: orderId,
      payment_status: "paid",
      amount_total: amountCents,
      currency: "usd",
      payment_intent: "pi_test_123",
    },
  },
});

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

describe("checkout security", () => {
  it("never creates a paid order when the gateway is not configured", async () => {
    const product = await createProduct({ price: 59 });
    const res = await request(app)
      .post("/api/v1/payments/checkout")
      .send({ productType: "template", productId: product.id, customerEmail: "guest@themora.test", gateway: "lemonsqueezy" });

    expect(res.status).toBe(503);
    const order = await prisma.orderInvoice.findFirst();
    expect(order?.status).toBe("FAILED");
    expect(await prisma.license.count()).toBe(0);
  });

  it("only lets admins record manual orders", async () => {
    const product = await createProduct({ price: 59 });
    const body = { templateId: product.id, customerEmail: "client@themora.test", paymentMethod: "Bank transfer" };

    const user = await createTestUser();
    expect((await request(app).post("/api/v1/orders").set(user.authHeader).send(body)).status).toBe(403);
    expect(await prisma.license.count()).toBe(0);

    const admin = await createTestAdmin();
    const res = await request(app).post("/api/v1/orders").set(admin.authHeader).send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("COMPLETED");
    expect(res.body.data.licenses).toHaveLength(1);
  });
});

describe("cart checkout pricing", () => {
  it("prices items from the database, including sale and extended prices", async () => {
    mockStripeSession();
    const nimbus = await createProduct({ title: "Nimbus", price: 149, salePrice: 119 });
    const ledger = await createProduct({ title: "Ledger", price: 59, extendedPrice: 229 });
    const { authHeader, user } = await createTestUser();

    const res = await request(app)
      .post("/api/v1/checkout")
      .set(authHeader)
      .send({
        gateway: "stripe",
        items: [{ productId: nimbus.id }, { productId: ledger.id, licenseType: "EXTENDED" }],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.checkoutUrl).toContain("checkout.stripe.com");
    const order = await prisma.orderInvoice.findUnique({ where: { id: res.body.data.orderId }, include: { items: true } });
    expect(order).toMatchObject({ status: "PENDING", totalAmount: 348, chargeAmount: 348, chargeCurrency: "USD", userId: user.id, provider: "STRIPE" });
    expect(order?.items.map((i) => [i.title, i.total]).sort()).toEqual([
      ["Ledger (Extended licence)", 229],
      ["Nimbus (Single licence)", 119],
    ]);
  });

  it("rejects duplicates, unavailable products and missing extended licences", async () => {
    mockStripeSession();
    const product = await createProduct();
    const draft = await createProduct({ status: "DRAFT" });
    const send = (items: object[]) =>
      request(app).post("/api/v1/checkout").send({ gateway: "stripe", items, customer: { email: "a@themora.test" } });

    expect((await send([{ productId: product.id }, { productId: product.id }])).status).toBe(400);
    expect((await send([{ productId: draft.id }])).status).toBe(404);
    expect((await send([{ productId: product.id, licenseType: "EXTENDED" }])).status).toBe(400);
  });

  it("requires an email for guests", async () => {
    const product = await createProduct();
    const res = await request(app).post("/api/v1/checkout").send({ gateway: "stripe", items: [{ productId: product.id }] });
    expect(res.status).toBe(400);
  });

  it("completes free carts immediately without a gateway", async () => {
    const freebie = await createProduct({ isFree: true, price: 0 });
    const res = await request(app)
      .post("/api/v1/checkout")
      .send({ gateway: "stripe", items: [{ productId: freebie.id }], customer: { email: "fan@themora.test" } });

    expect(res.status).toBe(201);
    expect(res.body.data.gateway).toBe("free");
    expect(res.body.data.checkoutUrl).toBe(`https://themora.test/purchase/success?order_id=${res.body.data.orderId}`);
    const order = await prisma.orderInvoice.findUnique({ where: { id: res.body.data.orderId } });
    expect(order).toMatchObject({ status: "COMPLETED", provider: "FREE" });
    expect(await prisma.license.count({ where: { templateId: freebie.id } })).toBe(1);
  });
});

describe("Stripe webhooks", () => {
  const startStripeOrder = async () => {
    mockStripeSession();
    const product = await createProduct({ price: 79 });
    const res = await request(app)
      .post("/api/v1/checkout")
      .send({ gateway: "stripe", items: [{ productId: product.id }], customer: { email: "buyer@themora.test" } });
    return { product, orderId: res.body.data.orderId as string };
  };

  it("fulfils a paid session once, even when Stripe retries the event", async () => {
    const { product, orderId } = await startStripeOrder();
    const event = sessionCompletedEvent(orderId, 7900);

    const first = await sendStripeEvent(event);
    expect(first.status).toBe(200);
    const retry = await sendStripeEvent(event);
    expect(retry.body.duplicate).toBe(true);

    const order = await prisma.orderInvoice.findUnique({ where: { id: orderId } });
    expect(order).toMatchObject({ status: "COMPLETED", providerPaymentId: "pi_test_123" });
    expect(order?.paidAt).not.toBeNull();
    expect(await prisma.license.count({ where: { orderId } })).toBe(1);
    expect((await prisma.template.findUnique({ where: { id: product.id } }))?.totalPurchase).toBe(1);
  });

  it("rejects events with a bad signature", async () => {
    const { orderId } = await startStripeOrder();
    const res = await request(app)
      .post("/api/v1/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("Stripe-Signature", "t=1,v1=forged")
      .send(JSON.stringify(sessionCompletedEvent(orderId, 7900)));
    expect(res.status).toBe(400);
    expect((await prisma.orderInvoice.findUnique({ where: { id: orderId } }))?.status).toBe("PENDING");
  });

  it("refuses to fulfil when the paid amount does not match", async () => {
    const { orderId } = await startStripeOrder();
    await sendStripeEvent(sessionCompletedEvent(orderId, 100));
    const order = await prisma.orderInvoice.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe("FAILED");
    expect(order?.failureReason).toContain("mismatch");
    expect(await prisma.license.count()).toBe(0);
  });

  it("issues exactly one licence when two notifications arrive at once", async () => {
    const { orderId } = await startStripeOrder();
    const payment = { provider: "STRIPE" as const, amount: 79, currency: "usd", providerPaymentId: "pi_1" };
    await Promise.all([fulfillmentService.fulfillOrder(orderId, payment), fulfillmentService.fulfillOrder(orderId, payment)]);
    expect(await prisma.license.count({ where: { orderId } })).toBe(1);
  });

  it("marks expired sessions cancelled and full refunds refunded", async () => {
    const { orderId } = await startStripeOrder();
    await sendStripeEvent(sessionCompletedEvent(orderId, 7900));

    await sendStripeEvent({
      id: "evt_refund",
      object: "event",
      type: "charge.refunded",
      data: { object: { object: "charge", payment_intent: "pi_test_123", amount: 7900, amount_refunded: 7900 } },
    });
    expect((await prisma.orderInvoice.findUnique({ where: { id: orderId } }))?.status).toBe("REFUNDED");
    expect((await prisma.license.findFirst({ where: { orderId } }))?.isActive).toBe(false);

    const second = await startStripeOrder();
    await sendStripeEvent({
      id: "evt_expired",
      object: "event",
      type: "checkout.session.expired",
      data: { object: { object: "checkout.session", metadata: { orderId: second.orderId } } },
    });
    expect((await prisma.orderInvoice.findUnique({ where: { id: second.orderId } }))?.status).toBe("CANCELLED");
  });
});

describe("SSLCommerz", () => {
  const startSslOrder = async () => {
    Object.assign(env, { SSLCOMMERZ_STORE_ID: "themo_test", SSLCOMMERZ_STORE_PASSWORD: "themo_test@ssl" });
    const product = await createProduct({ price: 49 });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ status: "SUCCESS", GatewayPageURL: "https://sandbox.sslcommerz.com/EasyCheckOut/abc", sessionkey: "abc" })
    );
    const res = await request(app)
      .post("/api/v1/checkout")
      .send({ gateway: "sslcommerz", items: [{ productId: product.id }], customer: { email: "rahim@themora.test", phone: "01711111111" } });
    const order = await prisma.orderInvoice.findUniqueOrThrow({ where: { id: res.body.data.orderId } });
    return { res, order, fetchMock };
  };

  const mockValidation = (overrides: Record<string, string>) =>
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ status: "VALID", val_id: "val_1", bank_tran_id: "bank_1", currency_type: "BDT", risk_level: "0", ...overrides })
    );

  it("starts a BDT session with callback URLs and the order number as tran_id", async () => {
    const { res, order, fetchMock } = await startSslOrder();
    expect(res.status).toBe(201);
    expect(res.body.data.checkoutUrl).toBe("https://sandbox.sslcommerz.com/EasyCheckOut/abc");
    expect(order).toMatchObject({ chargeAmount: 5880, chargeCurrency: "BDT", provider: "SSLCOMMERZ" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://sandbox.sslcommerz.com/gwprocess/v4/api.php");
    const body = init?.body as URLSearchParams;
    expect(body.get("total_amount")).toBe("5880.00");
    expect(body.get("currency")).toBe("BDT");
    expect(body.get("tran_id")).toBe(order.orderNumber);
    expect(body.get("ipn_url")).toBe("https://api.themora.test/api/v1/webhooks/sslcommerz");
    expect(body.get("cus_phone")).toBe("01711111111");
  });

  it("fulfils a validated IPN and ignores the repeat", async () => {
    const { order } = await startSslOrder();
    mockValidation({ tran_id: order.orderNumber, currency_amount: "5880.00" });
    const ipn = { val_id: "val_1", tran_id: order.orderNumber, status: "VALID", amount: "5880.00" };

    expect((await request(app).post("/api/v1/webhooks/sslcommerz").type("form").send(ipn)).status).toBe(200);
    const repeat = await request(app).post("/api/v1/webhooks/sslcommerz").type("form").send(ipn);
    expect(repeat.body.duplicate).toBe(true);

    const updated = await prisma.orderInvoice.findUnique({ where: { id: order.id } });
    expect(updated).toMatchObject({ status: "COMPLETED", providerPaymentId: "bank_1" });
    expect(await prisma.license.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("does not trust an IPN that SSLCommerz says is invalid", async () => {
    const { order } = await startSslOrder();
    mockValidation({ status: "INVALID_TRANSACTION", tran_id: order.orderNumber, currency_amount: "5880.00" });
    await request(app).post("/api/v1/webhooks/sslcommerz").type("form").send({ val_id: "forged", tran_id: order.orderNumber, status: "VALID" });

    expect((await prisma.orderInvoice.findUnique({ where: { id: order.id } }))?.status).toBe("FAILED");
    expect(await prisma.license.count()).toBe(0);
  });

  it("holds risky payments for review", async () => {
    const { order } = await startSslOrder();
    mockValidation({ tran_id: order.orderNumber, currency_amount: "5880.00", risk_level: "1" });
    await request(app).post("/api/v1/webhooks/sslcommerz").type("form").send({ val_id: "val_1", tran_id: order.orderNumber, status: "VALID" });
    expect((await prisma.orderInvoice.findUnique({ where: { id: order.id } }))?.status).toBe("PROCESSING");
  });

  it("verifies on the success redirect and sends the browser to the frontend", async () => {
    const { order } = await startSslOrder();
    mockValidation({ tran_id: order.orderNumber, currency_amount: "5880.00" });
    const res = await request(app)
      .post("/api/v1/payments/sslcommerz/success")
      .type("form")
      .send({ val_id: "val_1", tran_id: order.orderNumber, status: "VALID" });

    expect(res.status).toBe(303);
    expect(res.headers.location).toBe(`https://themora.test/purchase/success?order_id=${order.id}`);
    expect((await prisma.orderInvoice.findUnique({ where: { id: order.id } }))?.status).toBe("COMPLETED");
  });

  it("marks cancelled payments and redirects", async () => {
    const { order } = await startSslOrder();
    const res = await request(app).post("/api/v1/payments/sslcommerz/cancel").type("form").send({ tran_id: order.orderNumber });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe(`https://themora.test/checkout/cancelled?order_id=${order.id}`);
    expect((await prisma.orderInvoice.findUnique({ where: { id: order.id } }))?.status).toBe("CANCELLED");
  });
});

describe("order status endpoint", () => {
  it("returns progress without customer details", async () => {
    const freebie = await createProduct({ isFree: true, price: 0, slug: "iconix" });
    const checkout = await request(app)
      .post("/api/v1/checkout")
      .send({ gateway: "stripe", items: [{ productId: freebie.id }], customer: { email: "private@themora.test" } });

    const res = await request(app).get(`/api/v1/payments/orders/${checkout.body.data.orderId}/status`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("COMPLETED");
    expect(res.body.data.items[0].product.slug).toBe("iconix");
    expect(JSON.stringify(res.body)).not.toContain("private@themora.test");
  });
});

describe("payment settings", () => {
  it("tells the checkout the BDT rate, which gateways are on and whether SSLCommerz is in sandbox", async () => {
    Object.assign(env, { USD_TO_BDT_RATE: 120, STRIPE_SECRET_KEY: "", SSLCOMMERZ_STORE_ID: "testbox", SSLCOMMERZ_STORE_PASSWORD: "qwerty", SSLCOMMERZ_SANDBOX: true });
    const res = await request(app).get("/api/v1/payments/config");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      currency: "USD",
      usdToBdtRate: 120,
      gateways: { stripe: { enabled: false }, sslcommerz: { enabled: true, sandbox: true } },
    });
    expect(JSON.stringify(res.body)).not.toContain("qwerty");
  });
});
