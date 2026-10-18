import crypto from "node:crypto";
import request from "supertest";
import Stripe from "stripe";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { env } from "../src/config/env";
import { fulfillmentService } from "../src/module/payment/fulfillment.service";
import { stripeGateway } from "../src/module/payment/gateways/stripe.gateway";
import { subscriptionService } from "../src/module/subscription/subscription.service";
import { createTestAdmin, createTestUser, prisma, resetDatabase } from "./helpers/db";
import { createCategory, createCompletedOrder, createProduct } from "./helpers/factories";

const WEBHOOK_SECRET = "whsec_commerce_test";
const originalEnv = { ...env };

beforeEach(async () => {
  await resetDatabase();
  Object.assign(env, originalEnv, { STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, FRONTEND_URL: "https://themora.test" });
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
  return request(app).post("/api/v1/webhooks/stripe").set("Content-Type", "application/json").set("Stripe-Signature", signature).send(payload);
};

const createCoupon = (data: Partial<Parameters<typeof prisma.coupon.create>[0]["data"]> = {}) =>
  prisma.coupon.create({ data: { code: `SAVE${crypto.randomBytes(2).toString("hex").toUpperCase()}`, type: "PERCENT", value: 10, ...data } });

const createPlan = (data: Partial<Parameters<typeof prisma.pricingPlan.create>[0]["data"]> = {}) =>
  prisma.pricingPlan.create({
    data: {
      slug: `plan-${crypto.randomBytes(3).toString("hex")}`,
      title: "All-Access",
      description: "Every product, every update",
      price: 29,
      features: ["All products"],
      billingInterval: "MONTH",
      grantsAllAccess: true,
      ...data,
    },
  });

describe("cart", () => {
  it("adds items, prices them live and rejects products the user already owns", async () => {
    const { user, authHeader } = await createTestUser();
    const nimbus = await createProduct({ title: "Nimbus", price: 149, salePrice: 119, extendedPrice: 449 });
    const owned = await createProduct({ title: "Owned" });
    await createCompletedOrder(user.id, owned.id);

    await request(app).post("/api/v1/me/cart/items").set(authHeader).send({ productId: nimbus.id });
    const extended = await request(app).patch(`/api/v1/me/cart/items/${nimbus.id}`).set(authHeader).send({ licenseType: "EXTENDED" });
    expect(extended.body.data).toMatchObject({ subtotal: 449, totalAmount: 449 });

    const single = await request(app).patch(`/api/v1/me/cart/items/${nimbus.id}`).set(authHeader).send({ licenseType: "SINGLE" });
    expect(single.body.data.items[0]).toMatchObject({ unitPrice: 119, total: 119 });

    const ownedRes = await request(app).post("/api/v1/me/cart/items").set(authHeader).send({ productId: owned.id });
    expect(ownedRes.status).toBe(409);
  });

  it("merges a guest cart and skips invalid items", async () => {
    const { authHeader } = await createTestUser();
    const a = await createProduct({ price: 20 });
    const b = await createProduct({ price: 30 });
    const draft = await createProduct({ status: "DRAFT" });

    const res = await request(app)
      .post("/api/v1/me/cart/merge")
      .set(authHeader)
      .send({ items: [{ productId: a.id }, { productId: b.id }, { productId: draft.id }, { productId: a.id, licenseType: "EXTENDED" }] });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.totalAmount).toBe(50);
    expect(res.body.data.skipped.sort()).toEqual([a.id, draft.id].sort());
  });

  it("applies a coupon, checks out, and after payment clears the cart and records the redemption", async () => {
    mockStripeSession();
    const { user, authHeader } = await createTestUser();
    const product = await createProduct({ price: 100 });
    const coupon = await createCoupon({ code: "LAUNCH20", value: 20 });

    await request(app).post("/api/v1/me/cart/items").set(authHeader).send({ productId: product.id });
    const applied = await request(app).post("/api/v1/me/cart/coupon").set(authHeader).send({ code: "launch20" });
    expect(applied.body.data).toMatchObject({ couponCode: "LAUNCH20", subtotal: 100, discountTotal: 20, totalAmount: 80 });

    const checkout = await request(app).post("/api/v1/me/cart/checkout").set(authHeader).send({ gateway: "stripe" });
    expect(checkout.status).toBe(201);
    const orderId = checkout.body.data.orderId;
    expect(await prisma.orderInvoice.findUnique({ where: { id: orderId } })).toMatchObject({ couponCode: "LAUNCH20", discountTotal: 20, totalAmount: 80 });

    await fulfillmentService.fulfillOrder(orderId, { provider: "STRIPE", amount: 80, currency: "USD" });
    expect(await prisma.cartItem.count({ where: { cart: { userId: user.id } } })).toBe(0);
    expect(await prisma.couponRedemption.count({ where: { couponId: coupon.id, orderId } })).toBe(1);
    expect((await prisma.coupon.findUnique({ where: { id: coupon.id } }))?.usesCount).toBe(1);
  });

  it("reports a saved coupon that stopped working instead of failing", async () => {
    const { authHeader } = await createTestUser();
    const product = await createProduct({ price: 100 });
    const coupon = await createCoupon({ code: "SHORTLIVED" });
    await request(app).post("/api/v1/me/cart/items").set(authHeader).send({ productId: product.id });
    await request(app).post("/api/v1/me/cart/coupon").set(authHeader).send({ code: "SHORTLIVED" });

    await prisma.coupon.update({ where: { id: coupon.id }, data: { isActive: false } });
    const cart = await request(app).get("/api/v1/me/cart").set(authHeader);
    expect(cart.body.data).toMatchObject({ couponCode: null, couponError: "This coupon code is not valid", totalAmount: 100 });
    expect((await request(app).post("/api/v1/me/cart/checkout").set(authHeader).send({ gateway: "stripe" })).status).toBe(400);
  });
});

describe("coupon rules", () => {
  const preview = (code: string, items: object[], email = "shopper@themora.test") =>
    request(app).post("/api/v1/coupons/validate").send({ code, items, email });

  it("caps percentage discounts and never discounts below zero", async () => {
    const product = await createProduct({ price: 300 });
    const cheap = await createProduct({ price: 15 });
    await createCoupon({ code: "BIG50", value: 50, maxDiscount: 100 });
    await createCoupon({ code: "MINUS25", type: "FIXED", value: 25 });

    expect((await preview("BIG50", [{ productId: product.id }])).body.data).toMatchObject({ discountTotal: 100, totalAmount: 200 });
    expect((await preview("MINUS25", [{ productId: cheap.id }])).body.data).toMatchObject({ discountTotal: 15, totalAmount: 0 });
  });

  it("only discounts eligible categories and splits the discount across items", async () => {
    const mobile = await createCategory();
    const web = await createCategory();
    const appA = await createProduct({ categoryId: mobile.id, price: 60 });
    const appB = await createProduct({ categoryId: mobile.id, price: 40 });
    const site = await createProduct({ categoryId: web.id, price: 50 });
    await createCoupon({ code: "APPS10", value: 10, categoryIds: [mobile.id] });

    const res = await preview("APPS10", [{ productId: appA.id }, { productId: appB.id }, { productId: site.id }]);
    expect(res.body.data).toMatchObject({ subtotal: 150, discountTotal: 10, totalAmount: 140 });
    expect(res.body.data.items.map((i: any) => i.discount)).toEqual([6, 4, 0]);

    await createCoupon({ code: "APPSONLY", value: 10, categoryIds: [mobile.id] });
    expect((await preview("APPSONLY", [{ productId: site.id }])).status).toBe(400);
  });

  it("enforces dates, usage limits, minimum spend, per-customer limits and first-order rules", async () => {
    const product = await createProduct({ price: 40 });
    const items = [{ productId: product.id }];
    await createCoupon({ code: "EXPIRED", endsAt: new Date(Date.now() - 1000) });
    await createCoupon({ code: "SOON", startsAt: new Date(Date.now() + 86_400_000) });
    await createCoupon({ code: "USEDUP", maxUses: 1, usesCount: 1 });
    await createCoupon({ code: "MIN50", minSubtotal: 50 });

    expect((await preview("EXPIRED", items)).body.message).toBe("This coupon has expired");
    expect((await preview("SOON", items)).body.message).toBe("This coupon is not active yet");
    expect((await preview("USEDUP", items)).body.message).toBe("This coupon has reached its usage limit");
    expect((await preview("MIN50", items)).body.message).toContain("Spend at least $50.00");
    expect((await preview("NOPE", items)).status).toBe(400);

    const { user } = await createTestUser({ email: "repeat@themora.test" });
    const once = await createCoupon({ code: "ONCE", perUserLimit: 1 });
    const pastOrder = await createCompletedOrder(user.id, (await createProduct()).id, "repeat@themora.test");
    await prisma.couponRedemption.create({ data: { couponId: once.id, orderId: pastOrder.id, email: "repeat@themora.test", discount: 4 } });
    await createCoupon({ code: "WELCOME", firstOrderOnly: true });

    expect((await preview("ONCE", items, "repeat@themora.test")).body.message).toBe("You have already used this coupon");
    expect((await preview("WELCOME", items, "repeat@themora.test")).body.message).toBe("This coupon is only valid on your first order");
    expect((await preview("WELCOME", items, "new@themora.test")).status).toBe(200);
  });

  it("lets admins manage coupons and deactivates used ones instead of deleting", async () => {
    const admin = await createTestAdmin();
    const user = await createTestUser();
    const body = { code: "blackfriday40", type: "PERCENT", value: 40, maxUses: 500, endsAt: "2030-11-30T23:59:59Z" };

    expect((await request(app).post("/api/v1/admin/coupons").set(user.authHeader).send(body)).status).toBe(403);
    const created = await request(app).post("/api/v1/admin/coupons").set(admin.authHeader).send(body);
    expect(created.status).toBe(201);
    expect(created.body.data.code).toBe("BLACKFRIDAY40");
    expect((await request(app).post("/api/v1/admin/coupons").set(admin.authHeader).send(body)).status).toBe(409);
    expect((await request(app).post("/api/v1/admin/coupons").set(admin.authHeader).send({ ...body, code: "X101", value: 150 })).status).toBe(400);

    await prisma.coupon.update({ where: { id: created.body.data.id }, data: { usesCount: 3 } });
    const removed = await request(app).delete(`/api/v1/admin/coupons/${created.body.data.id}`).set(admin.authHeader);
    expect(removed.body.data).toEqual({ deactivated: true });
  });
});

describe("flash sales", () => {
  it("applies a category sale to listings and checkout, and ignores it once expired", async () => {
    mockStripeSession();
    const admin = await createTestAdmin();
    const category = await createCategory();
    const product = await createProduct({ categoryId: category.id, price: 80, slug: "on-sale" });

    const sale = await request(app)
      .post("/api/v1/admin/sales")
      .set(admin.authHeader)
      .send({ categoryId: category.id, percent: 25, endsAt: new Date(Date.now() + 86_400_000).toISOString() });
    expect(sale.body.data).toEqual({ updated: 1 });
    expect((await request(app).get("/api/v1/products/on-sale")).body.data.salePrice).toBe(60);

    const checkout = await request(app)
      .post("/api/v1/checkout")
      .send({ gateway: "stripe", items: [{ productId: product.id }], customer: { email: "deal@themora.test" } });
    expect(checkout.body.data.chargeAmount).toBe(60);

    await prisma.template.update({ where: { id: product.id }, data: { saleEndsAt: new Date(Date.now() - 1000) } });
    expect((await request(app).get("/api/v1/products/on-sale")).body.data.salePrice).toBeNull();
    const fullPrice = await request(app)
      .post("/api/v1/checkout")
      .send({ gateway: "stripe", items: [{ productId: product.id }], customer: { email: "late@themora.test" } });
    expect(fullPrice.body.data.chargeAmount).toBe(80);
  });
});

describe("all-access subscriptions", () => {
  it("requires sign-in, a cart of its own and no coupon", async () => {
    const plan = await createPlan();
    const product = await createProduct();
    const { authHeader } = await createTestUser();
    await createCoupon({ code: "NOSUBS" });

    const guest = await request(app).post("/api/v1/checkout").send({ gateway: "stripe", items: [{ planId: plan.id }], customer: { email: "g@themora.test" } });
    expect(guest.status).toBe(401);
    const mixed = await request(app).post("/api/v1/checkout").set(authHeader).send({ gateway: "stripe", items: [{ planId: plan.id }, { productId: product.id }] });
    expect(mixed.status).toBe(400);
    const coupon = await request(app).post("/api/v1/checkout").set(authHeader).send({ gateway: "stripe", items: [{ planId: plan.id }], couponCode: "NOSUBS" });
    expect(coupon.status).toBe(400);
  });

  it("runs the Stripe lifecycle: subscribe, renew, cancel at period end, end", async () => {
    const createSession = mockStripeSession();
    const plan = await createPlan({ price: 29 });
    const { user, authHeader } = await createTestUser();

    const checkout = await request(app).post("/api/v1/checkout").set(authHeader).send({ gateway: "stripe", items: [{ planId: plan.id }] });
    expect(checkout.status).toBe(201);
    expect(createSession.mock.calls[0][2]).toMatchObject({ recurring: "month", userId: user.id, planId: plan.id });

    await sendStripeEvent({
      id: "evt_sub_checkout",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          object: "checkout.session",
          metadata: { orderId: checkout.body.data.orderId },
          payment_status: "paid",
          amount_total: 2900,
          currency: "usd",
          subscription: "sub_123",
          customer: "cus_123",
          invoice: "in_first",
        },
      },
    });

    const me = await request(app).get("/api/v1/me/subscription").set(authHeader);
    expect(me.body.data).toMatchObject({ status: "ACTIVE", isActive: true, autoRenew: true, providerSubscriptionId: "sub_123", canManageBilling: true });
    expect(await subscriptionService.hasAllAccess(user.id)).toBe(true);

    const renewal = {
      id: "evt_renewal",
      object: "event",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_renewal_1",
          object: "invoice",
          billing_reason: "subscription_cycle",
          subscription: "sub_123",
          amount_paid: 2900,
          lines: { data: [{ period: { end: Math.floor(Date.now() / 1000) + 60 * 86400 } }] },
        },
      },
    };
    await sendStripeEvent(renewal);
    await sendStripeEvent({ ...renewal, id: "evt_renewal_retry" });
    const renewals = await prisma.orderInvoice.findMany({ where: { providerPaymentId: "in_renewal_1" } });
    expect(renewals).toHaveLength(1);
    expect(renewals[0]).toMatchObject({ status: "COMPLETED", totalAmount: 29 });

    await sendStripeEvent({
      id: "evt_cancel",
      object: "event",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_123", object: "subscription", status: "active", cancel_at_period_end: true, current_period_end: Math.floor(Date.now() / 1000) + 86400 } },
    });
    const cancelling = await prisma.subscription.findUnique({ where: { providerSubscriptionId: "sub_123" } });
    expect(cancelling).toMatchObject({ cancelAtPeriodEnd: true, autoRenew: false, status: "ACTIVE" });
    expect(await subscriptionService.hasAllAccess(user.id)).toBe(true);

    await sendStripeEvent({
      id: "evt_deleted",
      object: "event",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_123", object: "subscription", status: "canceled" } },
    });
    expect(await subscriptionService.hasAllAccess(user.id)).toBe(false);
  });

  it("sells SSLCommerz time passes that extend when bought again", async () => {
    const plan = await createPlan({ price: 29 });
    const { user, authHeader } = await createTestUser();
    const buyPass = async () => {
      const order = await prisma.orderInvoice.create({
        data: {
          orderNumber: `TEST-${crypto.randomBytes(3).toString("hex")}`,
          userId: user.id,
          status: "PENDING",
          licenseType: "SINGLE",
          totalAmount: 29,
          chargeAmount: 3538,
          chargeCurrency: "BDT",
          customerEmail: user.email,
          items: { create: [{ pricingPlanId: plan.id, title: "All-Access plan (monthly)", unitPrice: 29, total: 29 }] },
        },
      });
      await fulfillmentService.fulfillOrder(order.id, { provider: "SSLCOMMERZ", amount: 3538, currency: "BDT" });
    };

    await buyPass();
    const first = await prisma.subscription.findFirstOrThrow({ where: { userId: user.id } });
    expect(first).toMatchObject({ provider: "SSLCOMMERZ", autoRenew: false, status: "ACTIVE" });

    await buyPass();
    const extended = await prisma.subscription.findFirstOrThrow({ where: { userId: user.id } });
    expect(await prisma.subscription.count({ where: { userId: user.id } })).toBe(1);
    const monthsAdded = (extended.currentPeriodEnd.getTime() - first.currentPeriodEnd.getTime()) / 86_400_000;
    expect(monthsAdded).toBeGreaterThanOrEqual(28);

    const resume = await request(app).post("/api/v1/me/subscription/resume").set(authHeader);
    expect(resume.status).toBe(400);
    const cancel = await request(app).post("/api/v1/me/subscription/cancel").set(authHeader);
    expect(cancel.body.data.cancelAtPeriodEnd).toBe(true);
  });
});
