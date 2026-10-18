import crypto from "node:crypto";
import request from "supertest";
import { OAuth2Client } from "google-auth-library";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentOtps = vi.hoisted(() => [] as string[]);
vi.mock("../src/utils/email", () => ({
  sendOtpEmail: vi.fn(async (_to: string, otp: string) => {
    sentOtps.push(otp);
  }),
  sendSubscriptionReminderEmail: vi.fn().mockResolvedValue(undefined),
  sendAbandonedCartEmail: vi.fn().mockResolvedValue(undefined),
  sendProductUpdateEmail: vi.fn().mockResolvedValue(undefined),
  sendRefundDecisionEmail: vi.fn().mockResolvedValue(undefined),
  sendContactNotification: vi.fn().mockResolvedValue(undefined),
  sendContactReplyEmail: vi.fn().mockResolvedValue(undefined),
}));

import app from "../src/app";
import { env } from "../src/config/env";
import * as email from "../src/utils/email";
import { hashToken } from "../src/utils/secureToken";
import { createTestUser, prisma, resetDatabase } from "./helpers/db";
import { createProduct } from "./helpers/factories";

const originalEnv = { ...env };

beforeEach(async () => {
  await resetDatabase();
  sentOtps.length = 0;
  vi.mocked(email.sendSubscriptionReminderEmail).mockClear();
  vi.mocked(email.sendAbandonedCartEmail).mockClear();
  Object.assign(env, originalEnv, { CRON_SECRET: "cron-test-secret", GOOGLE_CLIENT_ID: "" });
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  Object.assign(env, originalEnv);
  await prisma.$disconnect();
});

const register = (address: string) =>
  request(app).post("/api/v1/auth/register").send({ fullName: "Rahim Uddin", email: address, password: "Str0ngPass!" });

describe("OTP hardening", () => {
  it("stores only a hash of the OTP and locks after five wrong codes", async () => {
    expect((await register("otp@themora.test")).status).toBe(201);
    const otp = sentOtps[0];
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "otp@themora.test" } });
    expect(user.otpCode).not.toBe(otp);
    expect(user.otpCode).toMatch(/^[a-f0-9]{64}$/);

    const wrong = otp === "111111" ? "222222" : "111111";
    for (let attempt = 1; attempt <= 4; attempt++) {
      const res = await request(app).post("/api/v1/auth/verify-otp").send({ email: "otp@themora.test", otp: wrong });
      expect(res.body.message).toBe("Invalid OTP");
    }
    const locked = await request(app).post("/api/v1/auth/verify-otp").send({ email: "otp@themora.test", otp: wrong });
    expect(locked.body.message).toBe("Too many incorrect codes. Please request a new one");

    // Even the right code no longer works; a new one must be requested
    const afterLock = await request(app).post("/api/v1/auth/verify-otp").send({ email: "otp@themora.test", otp });
    expect(afterLock.status).toBe(400);

    await request(app).post("/api/v1/auth/resend-otp").send({ email: "otp@themora.test" });
    const fresh = sentOtps[1];
    expect((await request(app).post("/api/v1/auth/verify-otp").send({ email: "otp@themora.test", otp: fresh })).status).toBe(200);
  });

  it("limits password reset guesses too", async () => {
    const { user } = await createTestUser({ email: "reset@themora.test" });
    await request(app).post("/api/v1/auth/password-reset/request").send({ email: "reset@themora.test" });
    const otp = sentOtps[0];
    const wrong = otp === "111111" ? "222222" : "111111";
    for (let attempt = 0; attempt < 5; attempt++) {
      await request(app).post("/api/v1/auth/password-reset/confirm").send({ email: "reset@themora.test", otp: wrong, newPassword: "NewPass123!" });
    }
    const res = await request(app).post("/api/v1/auth/password-reset/confirm").send({ email: "reset@themora.test", otp, newPassword: "NewPass123!" });
    expect(res.status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).otpCode).toBeNull();
  });
});

describe("session tokens", () => {
  it("returns the raw token to the client but stores only its hash, and never leaks secrets", async () => {
    await createTestUser({ email: "login@themora.test", password: "Str0ngPass!" });
    const res = await request(app).post("/api/v1/auth/login").send({ email: "login@themora.test", password: "Str0ngPass!" });
    expect(res.status).toBe(200);
    const token = res.body.data.nextAuthSecret;

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: "login@themora.test" } });
    expect(stored.nextAuthSecret).toBe(hashToken(token));
    for (const field of ["password", "nextAuthSecret", "otpCode", "otpAttempts"]) {
      expect(res.body.data.user[field]).toBeUndefined();
    }

    const me = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.data?.password).toBeUndefined();
    expect((await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${stored.nextAuthSecret}`)).status).toBe(401);
  });
});

describe("Google sign-in", () => {
  it("rejects requests without a Google-verified ID token", async () => {
    const victim = await createTestUser({ email: "admin-victim@themora.test" });
    // The old request shape (email chosen by the caller) must not work
    const legacy = await request(app).post("/api/v1/auth/google-login").send({ email: victim.user.email, fullName: "Attacker", providerId: "x" });
    expect(legacy.status).toBe(400);

    Object.assign(env, { GOOGLE_CLIENT_ID: "client-123.apps.googleusercontent.com" });
    const forged = await request(app).post("/api/v1/auth/google").send({ idToken: "eyJhbGciOiJSUzI1NiJ9.forged.signature" });
    expect(forged.status).toBe(400);
    expect(forged.body.message).toBe("Google sign-in could not be verified");
  });

  it("signs in with the identity from a verified token, ignoring unverified emails", async () => {
    Object.assign(env, { GOOGLE_CLIENT_ID: "client-123.apps.googleusercontent.com" });
    const verify = vi.spyOn(OAuth2Client.prototype, "verifyIdToken") as any;
    verify.mockResolvedValueOnce({ getPayload: () => ({ email: "Nadia@Gmail.com", email_verified: true, sub: "google-sub-1", name: "Nadia Islam" }) });

    const res = await request(app).post("/api/v1/auth/google").send({ idToken: "x".repeat(40) });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ email: "nadia@gmail.com", provider: "google" });
    const stored = await prisma.user.findUniqueOrThrow({ where: { email: "nadia@gmail.com" } });
    expect(stored.nextAuthSecret).toBe(hashToken(res.body.data.nextAuthSecret));

    verify.mockResolvedValueOnce({ getPayload: () => ({ email: "unverified@gmail.com", email_verified: false, sub: "2" }) });
    expect((await request(app).post("/api/v1/auth/google").send({ idToken: "y".repeat(40) })).status).toBe(400);
  });
});

describe("CORS", () => {
  const allowOrigin = async (origin: string) =>
    (await request(app).get("/health").set("Origin", origin)).headers["access-control-allow-origin"];

  it("allows the frontend and its previews but not other vercel.app sites", async () => {
    expect(await allowOrigin("https://themora.vercel.app")).toBe("https://themora.vercel.app");
    expect(await allowOrigin("https://themora-git-new-checkout-parvej.vercel.app")).toBe("https://themora-git-new-checkout-parvej.vercel.app");
    expect(await allowOrigin("https://evil-shop.vercel.app")).toBeUndefined();
    expect(await allowOrigin("https://attacker.example")).toBeUndefined();
  });
});

describe("daily cron", () => {
  const runCron = (secret?: string) => {
    const req = request(app).get("/api/v1/internal/cron/daily");
    return secret ? req.set("Authorization", `Bearer ${secret}`) : req;
  };

  it("requires the cron secret", async () => {
    expect((await runCron()).status).toBe(401);
    expect((await runCron("wrong-secret")).status).toBe(401);
    Object.assign(env, { CRON_SECRET: "" });
    expect((await runCron("anything")).status).toBe(503);
  });

  it("expires passes, reminds once, nudges abandoned carts once, and tidies up", async () => {
    const day = 86_400_000;
    const { user } = await createTestUser({ email: "member@themora.test" });
    const plan = await prisma.pricingPlan.create({
      data: { slug: `pass-${crypto.randomBytes(2).toString("hex")}`, title: "All-Access", description: "All", price: 29, features: ["All"], billingInterval: "MONTH", grantsAllAccess: true },
    });
    const expired = await prisma.subscription.create({
      data: { userId: user.id, pricingPlanId: plan.id, provider: "SSLCOMMERZ", currentPeriodStart: new Date(Date.now() - 40 * day), currentPeriodEnd: new Date(Date.now() - day) },
    });
    const { user: other } = await createTestUser({ email: "soon@themora.test" });
    await prisma.subscription.create({
      data: { userId: other.id, pricingPlanId: plan.id, provider: "SSLCOMMERZ", currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 2 * day) },
    });

    const { user: shopper } = await createTestUser({ email: "shopper@themora.test" });
    const product = await createProduct({ title: "Pulse", price: 59 });
    await prisma.cart.create({
      data: { userId: shopper.id, items: { create: [{ productId: product.id, createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000) }] } },
    });

    const stale = await prisma.orderInvoice.create({
      data: { orderNumber: "TEST-STALE", status: "PENDING", licenseType: "SINGLE", totalAmount: 59, customerEmail: "x@themora.test", createdAt: new Date(Date.now() - 2 * day) },
    });
    const sale = await createProduct({ price: 80, salePrice: 60, saleEndsAt: new Date(Date.now() - day) });

    const first = await runCron("cron-test-secret");
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({
      expireSubscriptions: { expired: 1 },
      subscriptionReminders: { sent: 1 },
      abandonedCarts: { sent: 1 },
      staleOrders: { cancelled: 1 },
      expiredSales: { cleared: 1 },
    });
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: expired.id } })).status).toBe("EXPIRED");
    expect((await prisma.orderInvoice.findUniqueOrThrow({ where: { id: stale.id } })).status).toBe("CANCELLED");
    expect((await prisma.template.findUniqueOrThrow({ where: { id: sale.id } })).salePrice).toBeNull();
    expect(email.sendAbandonedCartEmail).toHaveBeenCalledWith("shopper@themora.test", "Test User", [{ title: "Pulse", price: 59 }]);

    const second = await runCron("cron-test-secret");
    expect(second.body.data).toMatchObject({ subscriptionReminders: { sent: 0 }, abandonedCarts: { sent: 0 } });
    expect(email.sendSubscriptionReminderEmail).toHaveBeenCalledTimes(1);
  });
});

describe("API docs", () => {
  it("serves an OpenAPI spec and Swagger UI", async () => {
    const spec = await request(app).get("/api/v1/openapi.json");
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toBe("3.1.0");
    expect(spec.body.paths["/checkout"].post.requestBody).toBeDefined();
    expect(spec.body.paths["/products"].get.parameters.map((p: any) => p.name)).toContain("tech");

    const docs = await request(app).get("/docs");
    expect(docs.status).toBe(200);
    expect(docs.text).toContain("swagger-ui");
  });
});
