import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { env } from "../src/config/env";
import { affiliateService } from "../src/module/affiliate/affiliate.service";
import { fulfillmentService } from "../src/module/payment/fulfillment.service";
import { stripeGateway } from "../src/module/payment/gateways/stripe.gateway";
import { createTestAdmin, createTestUser, prisma, resetDatabase } from "./helpers/db";
import { createProduct } from "./helpers/factories";

const originalEnv = { ...env };

beforeEach(async () => {
  await resetDatabase();
  Object.assign(env, originalEnv, { AFFILIATE_COMMISSION_RATE: 0.2, AFFILIATE_MIN_PAYOUT: 50, AFFILIATE_AUTO_APPROVE: true, REFUND_WINDOW_DAYS: 14 });
  vi.spyOn(stripeGateway, "createSession").mockImplementation(async (order) => ({
    url: "https://checkout.stripe.com/c/pay/test",
    sessionId: `cs_${order.orderNumber}`,
    chargeAmount: order.totalAmount,
    chargeCurrency: "USD",
  }));
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  Object.assign(env, originalEnv);
  await prisma.$disconnect();
});

const joinProgram = async (code = "RAHIM20") => {
  const affiliate = await createTestUser({ fullName: "Rahim Affiliate", email: `${code.toLowerCase()}@themora.test` });
  const res = await request(app)
    .post("/api/v1/me/affiliate")
    .set(affiliate.authHeader)
    .send({ code, payoutMethod: "bkash", payoutDetails: "01711111111" });
  return { ...affiliate, affiliate: res.body.data };
};

// A buyer checks out through a referral link and pays
const referredPurchase = async (code: string, price = 100, buyerEmail = "buyer@themora.test") => {
  const product = await createProduct({ price });
  const checkout = await request(app)
    .post("/api/v1/checkout")
    .send({ gateway: "stripe", items: [{ productId: product.id }], referralCode: code.toLowerCase(), customer: { email: buyerEmail } });
  await fulfillmentService.fulfillOrder(checkout.body.data.orderId, { provider: "STRIPE", amount: price, currency: "USD" });
  return checkout.body.data.orderId as string;
};

describe("joining", () => {
  it("auto-approves, keeps codes unique and allows one account per user", async () => {
    const { authHeader, affiliate } = await joinProgram("RAHIM20");
    expect(affiliate).toMatchObject({ code: "RAHIM20", status: "ACTIVE", commissionRate: 0.2 });

    expect((await request(app).post("/api/v1/me/affiliate").set(authHeader).send({ payoutMethod: "bkash", payoutDetails: "01711111111" })).status).toBe(409);

    const other = await createTestUser();
    const taken = await request(app).post("/api/v1/me/affiliate").set(other.authHeader).send({ code: "rahim20", payoutMethod: "paypal", payoutDetails: "x@paypal.me" });
    expect(taken.status).toBe(409);
    const generated = await request(app).post("/api/v1/me/affiliate").set(other.authHeader).send({ payoutMethod: "paypal", payoutDetails: "x@paypal.me" });
    expect(generated.body.data.code).toMatch(/^TESTUSER\d{2}$/);
  });

  it("waits for admin approval when auto-approve is off", async () => {
    Object.assign(env, { AFFILIATE_AUTO_APPROVE: false });
    const { affiliate } = await joinProgram("PENDING1");
    expect(affiliate.status).toBe("PENDING");

    const admin = await createTestAdmin();
    const approved = await request(app).patch(`/api/v1/admin/affiliates/${affiliate.id}`).set(admin.authHeader).send({ status: "ACTIVE", commissionRate: 0.3 });
    expect(approved.body.data).toMatchObject({ status: "ACTIVE", commissionRate: 0.3 });
    expect(approved.body.data.approvedAt).not.toBeNull();
  });
});

describe("tracking and attribution", () => {
  it("counts one click per visitor per day and ignores unknown codes", async () => {
    const { authHeader } = await joinProgram("CLICKS1");
    const click = () => request(app).post("/api/v1/affiliates/click").set("User-Agent", "Mozilla/5.0 test").send({ code: "clicks1", landingPath: "/products/nimbus" });

    expect((await click()).body.data).toEqual({ valid: true });
    await click();
    expect((await request(app).post("/api/v1/affiliates/click").send({ code: "NOPE99" })).body.data).toEqual({ valid: false });

    const dashboard = await request(app).get("/api/v1/me/affiliate").set(authHeader);
    expect(dashboard.body.data.stats.clicks).toBe(1);
  });

  it("credits commission on the amount actually paid, after coupons", async () => {
    const { authHeader, affiliate } = await joinProgram("PARTNER1");
    await prisma.coupon.create({ data: { code: "HALF", type: "PERCENT", value: 50 } });
    const product = await createProduct({ price: 120 });

    const checkout = await request(app)
      .post("/api/v1/checkout")
      .send({ gateway: "stripe", items: [{ productId: product.id }], couponCode: "HALF", referralCode: "PARTNER1", customer: { email: "fan@themora.test" } });
    await fulfillmentService.fulfillOrder(checkout.body.data.orderId, { provider: "STRIPE", amount: 60, currency: "USD" });

    const referral = await prisma.referral.findUniqueOrThrow({ where: { orderId: checkout.body.data.orderId } });
    expect(referral).toMatchObject({ affiliateId: affiliate.id, orderAmount: 60, commission: 12, status: "PENDING" });

    const list = await request(app).get("/api/v1/me/affiliate/referrals").set(authHeader);
    expect(list.body.data[0].commission).toBe(12);
    expect(JSON.stringify(list.body)).not.toContain("fan@themora.test");
  });

  it("ignores self-referrals and suspended affiliates", async () => {
    const { user, affiliate } = await joinProgram("SELFIE1");
    const product = await createProduct({ price: 50 });
    const own = await request(app)
      .post("/api/v1/checkout")
      .send({ gateway: "stripe", items: [{ productId: product.id }], referralCode: "SELFIE1", customer: { email: user.email } });
    expect((await prisma.orderInvoice.findUniqueOrThrow({ where: { id: own.body.data.orderId } })).affiliateId).toBeNull();

    await prisma.affiliate.update({ where: { id: affiliate.id }, data: { status: "SUSPENDED" } });
    const orderId = await referredPurchase("SELFIE1", 50, "someone@themora.test");
    expect((await prisma.orderInvoice.findUniqueOrThrow({ where: { id: orderId } })).affiliateId).toBeNull();
    expect(await prisma.referral.count()).toBe(0);
  });

  it("reverses commission when the order is refunded", async () => {
    await joinProgram("REFUND1");
    const orderId = await referredPurchase("REFUND1");
    await fulfillmentService.markRefunded(orderId);
    expect((await prisma.referral.findUniqueOrThrow({ where: { orderId } })).status).toBe("REVERSED");
  });
});

describe("approval and payouts", () => {
  it("approves after the refund window, then pays out through an admin", async () => {
    const { authHeader, affiliate } = await joinProgram("PAYME1");
    const admin = await createTestAdmin();
    await referredPurchase("PAYME1", 100, "a@themora.test");
    await referredPurchase("PAYME1", 200, "b@themora.test");

    // Still inside the refund window: nothing to pay yet
    expect((await affiliateService.approveMatured()).approved).toBe(0);
    expect((await request(app).post("/api/v1/me/affiliate/payouts").set(authHeader)).status).toBe(400);

    await prisma.referral.updateMany({ data: { approvableAt: new Date(Date.now() - 1000) } });
    expect((await affiliateService.approveMatured()).approved).toBe(2);

    const before = await request(app).get("/api/v1/me/affiliate").set(authHeader);
    expect(before.body.data.stats).toMatchObject({ conversions: 2, pending: 0, available: 60, lifetime: 60 });

    const payout = await request(app).post("/api/v1/me/affiliate/payouts").set(authHeader);
    expect(payout.status).toBe(201);
    expect(payout.body.data).toMatchObject({ amount: 60, method: "bkash", details: "01711111111", status: "REQUESTED" });
    expect((await request(app).post("/api/v1/me/affiliate/payouts").set(authHeader)).status).toBe(409);
    expect((await request(app).get("/api/v1/me/affiliate").set(authHeader)).body.data.stats).toMatchObject({ available: 0, requested: 60 });

    const paid = await request(app).post(`/api/v1/admin/affiliate-payouts/${payout.body.data.id}/pay`).set(admin.authHeader).send({ reference: "bKash TX 8N7A6K2" });
    expect(paid.body.data.status).toBe("PAID");
    expect(await prisma.referral.count({ where: { affiliateId: affiliate.id, status: "PAID" } })).toBe(2);
    expect((await request(app).get("/api/v1/me/affiliate").set(authHeader)).body.data.stats).toMatchObject({ paid: 60, available: 0 });
  });

  it("returns commission to the balance when a payout is rejected", async () => {
    const { authHeader } = await joinProgram("REJECT1");
    const admin = await createTestAdmin();
    await referredPurchase("REJECT1", 300);
    await prisma.referral.updateMany({ data: { approvableAt: new Date(Date.now() - 1000) } });
    await affiliateService.approveMatured();

    const payout = await request(app).post("/api/v1/me/affiliate/payouts").set(authHeader);
    const rejected = await request(app)
      .post(`/api/v1/admin/affiliate-payouts/${payout.body.data.id}/reject`)
      .set(admin.authHeader)
      .send({ note: "The bKash number is not registered. Please update it." });
    expect(rejected.body.data.status).toBe("REJECTED");
    expect((await request(app).get("/api/v1/me/affiliate").set(authHeader)).body.data.stats).toMatchObject({ available: 60, requested: 0 });
  });
});
