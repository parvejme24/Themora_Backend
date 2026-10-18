import crypto from "node:crypto";
import request from "supertest";
import { authenticator } from "otplib";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/utils/email", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
  sendProductUpdateEmail: vi.fn().mockResolvedValue(undefined),
  sendRefundDecisionEmail: vi.fn().mockResolvedValue(undefined),
  sendSubscriptionReminderEmail: vi.fn().mockResolvedValue(undefined),
  sendAbandonedCartEmail: vi.fn().mockResolvedValue(undefined),
  sendContactNotification: vi.fn().mockResolvedValue(undefined),
  sendContactReplyEmail: vi.fn().mockResolvedValue(undefined),
}));

import app from "../src/app";
import { env } from "../src/config/env";
import { fulfillmentService } from "../src/module/payment/fulfillment.service";
import { createTestAdmin, createTestUser, prisma, resetDatabase } from "./helpers/db";
import { createCategory, createCompletedOrder, createProduct } from "./helpers/factories";

const originalEnv = { ...env };

beforeEach(async () => {
  await resetDatabase();
  Object.assign(env, originalEnv, { ENCRYPTION_KEY: "test-encryption-key-please-change" });
});
afterAll(async () => {
  Object.assign(env, originalEnv);
  await prisma.$disconnect();
});

// Background writes (audit log, view tracking) finish shortly after the response
const eventually = async <T>(check: () => Promise<T | null | undefined | false>, timeoutMs = 8000): Promise<T> => {
  const started = Date.now();
  for (;;) {
    const result = await check();
    if (result) return result;
    if (Date.now() - started > timeoutMs) throw new Error("Condition not met in time");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
};

const paidOrder = async (user: { id: string; email: string }, productId: string, amount = 49) => {
  const order = await prisma.orderInvoice.create({
    data: {
      orderNumber: `TEST-${crypto.randomBytes(3).toString("hex")}`,
      userId: user.id,
      status: "PENDING",
      licenseType: "SINGLE",
      totalAmount: amount,
      chargeAmount: amount,
      chargeCurrency: "USD",
      customerEmail: user.email,
      items: { create: [{ productId, title: "Product (Single licence)", unitPrice: amount, total: amount }] },
    },
  });
  await fulfillmentService.fulfillOrder(order.id, { provider: "STRIPE", amount, currency: "USD" });
  return order;
};

describe("staff roles", () => {
  it("gives each role only its own areas", async () => {
    const editor = await createTestUser({ role: "EDITOR" });
    const support = await createTestUser({ role: "SUPPORT" });
    const moderator = await createTestUser({ role: "MODERATOR" });
    const customer = await createTestUser();
    const category = await createCategory();
    const product = { title: "Editor Product", shortDescription: "Created by an editor account", categoryId: category.id, price: 30, status: "PUBLISHED" };

    expect((await request(app).post("/api/v1/admin/products").set(editor.authHeader).send(product)).status).toBe(201);
    expect((await request(app).get("/api/v1/admin/refund-requests").set(editor.authHeader)).status).toBe(403);
    expect((await request(app).get("/api/v1/admin/audit-logs").set(editor.authHeader)).status).toBe(403);

    expect((await request(app).get("/api/v1/admin/tickets").set(support.authHeader)).status).toBe(200);
    expect((await request(app).post("/api/v1/admin/products").set(support.authHeader).send(product)).status).toBe(403);

    expect((await request(app).get("/api/v1/admin/reviews").set(moderator.authHeader)).status).toBe(200);
    expect((await request(app).get("/api/v1/admin/coupons").set(moderator.authHeader)).status).toBe(403);

    expect((await request(app).get("/api/v1/admin/tickets").set(customer.authHeader)).status).toBe(403);

    const prefs = await request(app).get("/api/v1/me/preferences").set(support.authHeader);
    expect(prefs.body.data).toMatchObject({ role: "SUPPORT", permissions: ["support"] });
  });
});

describe("audit log", () => {
  it("records successful staff changes with secrets redacted, and nothing else", async () => {
    const admin = await createTestAdmin();
    const customer = await createTestUser();
    const category = await createCategory();

    const created = await request(app)
      .post("/api/v1/admin/coupons")
      .set(admin.authHeader)
      .send({ code: "AUDIT10", type: "PERCENT", value: 10, apiToken: "should-not-be-stored" });
    expect(created.status).toBe(201);
    await request(app).post("/api/v1/admin/coupons").set(admin.authHeader).send({ code: "X", type: "PERCENT", value: 10 }); // 400
    await request(app).get("/api/v1/admin/coupons").set(admin.authHeader); // read
    await request(app).post("/api/v1/me/wishlist").set(customer.authHeader).send({ productId: (await createProduct({ categoryId: category.id })).id });

    const log = await eventually(() => prisma.auditLog.findFirst({ where: { action: "POST /api/v1/admin/coupons" } }));
    expect(log).toMatchObject({ actorId: admin.user.id, actorRole: "ADMIN", entityType: "coupons" });
    expect(log.metadata).toMatchObject({ code: "AUDIT10", apiToken: "[redacted]" });

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await prisma.auditLog.count()).toBe(1);

    const listed = await request(app).get("/api/v1/admin/audit-logs").set(admin.authHeader);
    expect(listed.body.data[0].actor.email).toBe(admin.user.email);
  });
});

describe("support tickets", () => {
  it("runs a conversation between a buyer and support with notifications", async () => {
    const buyer = await createTestUser({ fullName: "Buyer" });
    const stranger = await createTestUser();
    const agent = await createTestUser({ role: "SUPPORT", fullName: "Agent" });
    const product = await createProduct({ title: "Nimbus" });
    await createCompletedOrder(buyer.user.id, product.id);

    expect(
      (await request(app).post("/api/v1/me/tickets").set(stranger.authHeader).send({ subject: "Need help please", message: "How do I install this theme?", productId: product.id })).status
    ).toBe(403);

    const opened = await request(app)
      .post("/api/v1/me/tickets")
      .set(buyer.authHeader)
      .send({ subject: "Build fails on Vercel", message: "Deploying gives a Prisma error during build.", productId: product.id, priority: "URGENT" });
    expect(opened.status).toBe(201);
    const ticket = opened.body.data;
    expect(ticket).toMatchObject({ status: "AWAITING_SUPPORT", priority: "HIGH" });

    expect((await request(app).get(`/api/v1/tickets/${ticket.id}`).set(stranger.authHeader)).status).toBe(404);

    const queue = await request(app).get("/api/v1/admin/tickets").set(agent.authHeader);
    expect(queue.body.data.map((t: any) => t.id)).toContain(ticket.id);

    await request(app).post(`/api/v1/tickets/${ticket.id}/messages`).set(agent.authHeader).send({ body: "Add prisma generate to your build command." });
    const afterStaff = await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(afterStaff).toMatchObject({ status: "AWAITING_CUSTOMER", assignedToId: agent.user.id });

    const buyerNotes = await request(app).get("/api/v1/me/notifications").set(buyer.authHeader);
    expect(buyerNotes.body.unreadCount).toBeGreaterThanOrEqual(1);
    expect(buyerNotes.body.data[0]).toMatchObject({ type: "ticket_reply" });

    await request(app).post(`/api/v1/tickets/${ticket.id}/messages`).set(buyer.authHeader).send({ body: "That fixed it, thanks!" });
    expect((await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe("AWAITING_SUPPORT");
    expect((await request(app).get("/api/v1/me/notifications?unread=true").set(agent.authHeader)).body.unreadCount).toBe(1);

    const full = await request(app).get(`/api/v1/tickets/${ticket.id}`).set(buyer.authHeader);
    expect(full.body.data.messages.map((m: any) => m.isStaff)).toEqual([false, true, false]);

    await request(app).post(`/api/v1/tickets/${ticket.id}/close`).set(buyer.authHeader);
    expect((await request(app).post(`/api/v1/tickets/${ticket.id}/messages`).set(buyer.authHeader).send({ body: "One more thing" })).status).toBe(400);
  });

  it("only assigns tickets to support staff", async () => {
    const buyer = await createTestUser();
    const admin = await createTestAdmin();
    const customer = await createTestUser();
    const opened = await request(app).post("/api/v1/me/tickets").set(buyer.authHeader).send({ subject: "Billing question", message: "Can I get an invoice with my VAT number?" });

    const bad = await request(app).patch(`/api/v1/admin/tickets/${opened.body.data.id}`).set(admin.authHeader).send({ assignedToId: customer.user.id });
    expect(bad.status).toBe(400);
    const good = await request(app).patch(`/api/v1/admin/tickets/${opened.body.data.id}`).set(admin.authHeader).send({ assignedToId: admin.user.id, priority: "URGENT" });
    expect(good.body.data).toMatchObject({ priority: "URGENT" });
  });
});

describe("notifications and preferences", () => {
  it("notifies buyers when an order completes and supports read state", async () => {
    const { user, authHeader } = await createTestUser();
    await paidOrder(user, (await createProduct()).id);
    await paidOrder(user, (await createProduct()).id);

    const list = await request(app).get("/api/v1/me/notifications").set(authHeader);
    expect(list.body.unreadCount).toBe(2);
    expect(list.body.data[0].type).toBe("order_completed");

    await request(app).patch(`/api/v1/me/notifications/${list.body.data[0].id}/read`).set(authHeader);
    expect((await request(app).get("/api/v1/me/notifications").set(authHeader)).body.unreadCount).toBe(1);
    await request(app).post("/api/v1/me/notifications/read-all").set(authHeader);
    expect((await request(app).get("/api/v1/me/notifications").set(authHeader)).body.unreadCount).toBe(0);

    const prefs = await request(app).patch("/api/v1/me/preferences").set(authHeader).send({ marketingEmails: false });
    expect(prefs.body.data).toEqual({ marketingEmails: false });
  });
});

describe("two-factor authentication", () => {
  it("requires an authenticator code after the password and supports recovery codes", async () => {
    const { authHeader } = await createTestUser({ email: "secure@themora.test", password: "Str0ngPass!" });
    const setup = await request(app).post("/api/v1/me/2fa/setup").set(authHeader);
    const { secret, otpauthUrl } = setup.body.data;
    expect(otpauthUrl).toContain("otpauth://totp/Themora:secure%40themora.test");
    expect((await prisma.user.findUniqueOrThrow({ where: { email: "secure@themora.test" } })).twoFactorSecret).not.toContain(secret);

    expect((await request(app).post("/api/v1/me/2fa/enable").set(authHeader).send({ code: "000000" })).status).toBe(400);
    const enabled = await request(app).post("/api/v1/me/2fa/enable").set(authHeader).send({ code: authenticator.generate(secret) });
    const recoveryCodes: string[] = enabled.body.data.recoveryCodes;
    expect(recoveryCodes).toHaveLength(8);

    const login = () => request(app).post("/api/v1/auth/login").send({ email: "secure@themora.test", password: "Str0ngPass!" });
    const step1 = await login();
    expect(step1.body.data).toMatchObject({ twoFactorRequired: true });
    expect(step1.body.data.nextAuthSecret).toBeUndefined();

    const wrong = await request(app).post("/api/v1/auth/2fa/verify").send({ challengeToken: step1.body.data.challengeToken, code: "123456" });
    expect(wrong.status).toBe(400);
    const step2 = await request(app).post("/api/v1/auth/2fa/verify").send({ challengeToken: step1.body.data.challengeToken, code: authenticator.generate(secret) });
    expect(step2.status).toBe(200);
    expect((await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${step2.body.data.nextAuthSecret}`)).status).toBe(200);
    expect(step2.body.data.user.twoFactorSecret).toBeUndefined();

    // Recovery codes work once
    const viaRecovery = await request(app).post("/api/v1/auth/2fa/verify").send({ challengeToken: (await login()).body.data.challengeToken, code: recoveryCodes[0].toLowerCase() });
    expect(viaRecovery.status).toBe(200);
    const reused = await request(app).post("/api/v1/auth/2fa/verify").send({ challengeToken: (await login()).body.data.challengeToken, code: recoveryCodes[0] });
    expect(reused.status).toBe(400);

    const session = { Authorization: `Bearer ${viaRecovery.body.data.nextAuthSecret}` };
    expect((await request(app).post("/api/v1/me/2fa/disable").set(session).send({ password: "Str0ngPass!" })).status).toBe(200);
    expect((await login()).body.data.nextAuthSecret).toBeDefined();
  });
});

describe("analytics and personalisation", () => {
  it("tracks views and sales per day and reports them", async () => {
    const admin = await createTestAdmin();
    const viewer = await createTestUser();
    const { user: buyer } = await createTestUser();
    const product = await createProduct({ slug: "tracked", price: 80 });

    await request(app).get("/api/v1/products/tracked").set(viewer.authHeader);
    await request(app).get("/api/v1/products/tracked");
    await eventually(async () => ((await prisma.productDailyStat.findFirst({ where: { productId: product.id } }))?.views ?? 0) >= 2);
    await paidOrder(buyer, product.id, 80);

    const stats = await request(app).get(`/api/v1/admin/analytics/products/${product.id}?days=7`).set(admin.authHeader);
    expect(stats.body.data.totals).toMatchObject({ views: 2, sales: 1, revenue: 80, conversionRate: 50 });
    expect(stats.body.data.daily).toHaveLength(7);

    const overview = await request(app).get("/api/v1/admin/analytics/overview?days=7").set(admin.authHeader);
    expect(overview.body.data.totals).toMatchObject({ revenue: 80, orders: 1, averageOrderValue: 80 });
    expect(overview.body.data.topProducts[0]).toMatchObject({ product: { slug: "tracked" }, sales: 1 });

    const recent = await eventually(async () => {
      const res = await request(app).get("/api/v1/me/recently-viewed").set(viewer.authHeader);
      return res.body.data.length ? res : null;
    });
    expect(recent.body.data[0].slug).toBe("tracked");
  });

  it("recommends products bought by the same customers", async () => {
    const { user: first } = await createTestUser();
    const { user: second } = await createTestUser();
    const main = await createProduct({ slug: "main-kit" });
    const companion = await createProduct({ title: "Companion" });
    const other = await createProduct({ title: "Other" });
    await paidOrder(first, main.id);
    await paidOrder(first, companion.id);
    await paidOrder(second, main.id);
    await paidOrder(second, companion.id);
    await paidOrder(second, other.id);

    const res = await request(app).get("/api/v1/products/main-kit/also-bought");
    expect(res.body.data.map((p: any) => p.title)).toEqual(["Companion", "Other"]);
  });
});
