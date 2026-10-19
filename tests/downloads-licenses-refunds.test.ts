import crypto from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/utils/email", () => ({
  sendProductUpdateEmail: vi.fn().mockResolvedValue(undefined),
  sendRefundDecisionEmail: vi.fn().mockResolvedValue(undefined),
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
  sendContactNotification: vi.fn().mockResolvedValue(undefined),
  sendContactReplyEmail: vi.fn().mockResolvedValue(undefined),
}));

import app from "../src/app";
import { env } from "../src/config/env";
import { fulfillmentService } from "../src/module/payment/fulfillment.service";
import { sslcommerzGateway } from "../src/module/payment/gateways/sslcommerz.gateway";
import { stripeGateway } from "../src/module/payment/gateways/stripe.gateway";
import { createTestAdmin, createTestUser, prisma, resetDatabase } from "./helpers/db";
import { createProduct } from "./helpers/factories";

const originalEnv = { ...env };

beforeEach(async () => {
  await resetDatabase();
  Object.assign(env, originalEnv, {
    CLOUDINARY_CLOUD_NAME: "themora-test",
    CLOUDINARY_API_KEY: "123456789",
    CLOUDINARY_API_SECRET: "test-secret",
    CLOUDINARY_URL: "",
    REFUND_WINDOW_DAYS: 14,
  });
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  Object.assign(env, originalEnv);
  await prisma.$disconnect();
});

// Creates a paid order through the real fulfilment path
const buy = async (
  user: { id: string; email: string },
  product: { id: string; title: string },
  options: { amount?: number; provider?: "STRIPE" | "SSLCOMMERZ"; paidDaysAgo?: number } = {}
) => {
  const amount = options.amount ?? 69;
  const provider = options.provider ?? "STRIPE";
  const order = await prisma.orderInvoice.create({
    data: {
      orderNumber: `TEST-${crypto.randomBytes(3).toString("hex")}`,
      userId: user.id,
      status: "PENDING",
      licenseType: "SINGLE",
      totalAmount: amount,
      chargeAmount: provider === "SSLCOMMERZ" ? amount * 122 : amount,
      chargeCurrency: provider === "SSLCOMMERZ" ? "BDT" : "USD",
      customerEmail: user.email,
      items: { create: [{ productId: product.id, title: `${product.title} (Single licence)`, unitPrice: amount, total: amount }] },
    },
  });
  await fulfillmentService.fulfillOrder(order.id, {
    provider,
    providerPaymentId: provider === "STRIPE" ? `pi_${order.orderNumber}` : `bank_${order.orderNumber}`,
    amount: provider === "SSLCOMMERZ" ? amount * 122 : amount,
    currency: provider === "SSLCOMMERZ" ? "BDT" : "USD",
  });
  if (options.paidDaysAgo) {
    await prisma.orderInvoice.update({ where: { id: order.id }, data: { paidAt: new Date(Date.now() - options.paidDaysAgo * 86_400_000) } });
  }
  const license = await prisma.license.findFirstOrThrow({ where: { orderId: order.id } });
  return { order, license };
};

const releaseVersion = (authHeader: object, productId: string, version: string, extra: object = {}) =>
  request(app)
    .post(`/api/v1/admin/products/${productId}/versions`)
    .set(authHeader)
    .send({
      version,
      changelog: `- Release ${version}`,
      files: [{ name: `source-${version}.zip`, cloudinaryId: `themora/source-files/source-${version}.zip`, size: 4_800_000 }],
      ...extra,
    });

describe("versions and secure downloads", () => {
  it("gives buyers short-lived signed links and refuses everyone else", async () => {
    const admin = await createTestAdmin();
    const buyer = await createTestUser();
    const stranger = await createTestUser();
    const product = await createProduct({ title: "Nimbus" });
    await buy(buyer.user, product);
    await releaseVersion(admin.authHeader, product.id, "1.0");

    const res = await request(app).post(`/api/v1/downloads/${product.id}`).set(buyer.authHeader).send({});
    expect(res.status).toBe(200);
    const [file] = res.body.data.files;
    expect(file.name).toBe("source-1.0.zip");
    expect(file.url).toContain("api.cloudinary.com/v1_1/themora-test/raw/download");
    expect(file.url).toContain("expires_at=");
    expect(file.url).toContain("signature=");
    expect(new Date(file.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(300_000);

    expect((await request(app).post(`/api/v1/downloads/${product.id}`).set(stranger.authHeader).send({})).status).toBe(403);
    expect(await prisma.downloadLog.count({ where: { productId: product.id } })).toBe(1);
    expect((await prisma.template.findUnique({ where: { id: product.id } }))?.downloads).toBe(1);
  });

  it("lets anyone signed in download free products and enforces a daily limit", async () => {
    const admin = await createTestAdmin();
    const { user, authHeader } = await createTestUser();
    const freebie = await createProduct({ isFree: true, price: 0 });
    await releaseVersion(admin.authHeader, freebie.id, "2.0");

    expect((await request(app).post(`/api/v1/downloads/${freebie.id}`).set(authHeader).send({})).status).toBe(200);

    await prisma.downloadLog.createMany({ data: Array.from({ length: 50 }, () => ({ userId: user.id, productId: freebie.id })) });
    expect((await request(app).post(`/api/v1/downloads/${freebie.id}`).set(authHeader).send({})).status).toBe(429);
  });

  it("keeps a public changelog, tracks the latest version and promotes on delete", async () => {
    const admin = await createTestAdmin();
    const product = await createProduct({ slug: "versioned" });
    await releaseVersion(admin.authHeader, product.id, "1.0");
    const v2 = await releaseVersion(admin.authHeader, product.id, "2.1");
    expect(v2.status).toBe(201);
    expect((await releaseVersion(admin.authHeader, product.id, "2.1")).status).toBe(409);
    expect((await releaseVersion(admin.authHeader, product.id, "two")).status).toBe(400);

    const changelog = await request(app).get("/api/v1/products/versioned/versions");
    expect(changelog.body.data.map((v: any) => [v.version, v.isLatest])).toEqual([["2.1", true], ["1.0", false]]);
    expect(JSON.stringify(changelog.body)).not.toContain("cloudinaryId");
    expect((await prisma.template.findUnique({ where: { id: product.id } }))?.version).toBe(2.1);

    await request(app).delete(`/api/v1/admin/versions/${v2.body.data.id}`).set(admin.authHeader);
    const after = await prisma.productVersion.findMany({ where: { productId: product.id } });
    expect(after.map((v) => [v.version, v.isLatest])).toEqual([["1.0", true]]);
  });

  it("serves legacy source files through the old route with the same access rules", async () => {
    const buyer = await createTestUser();
    const product = await createProduct({ sourceFiles: ["https://res.cloudinary.com/demo/raw/upload/v1/themora/legacy.zip"] });
    await buy(buyer.user, product);

    const res = await request(app).get(`/api/v1/templates/${product.id}/download/0`).set(buyer.authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.downloadUrl).toBe("https://res.cloudinary.com/demo/raw/upload/fl_attachment/v1/themora/legacy.zip");

    const stranger = await createTestUser();
    expect((await request(app).get(`/api/v1/templates/${product.id}/download/0`).set(stranger.authHeader)).status).toBe(403);
  });

  it("signs direct uploads for admins only, with source files kept private", async () => {
    const admin = await createTestAdmin();
    const user = await createTestUser();
    expect((await request(app).post("/api/v1/admin/uploads/signature").set(user.authHeader).send({ kind: "source" })).status).toBe(403);

    const res = await request(app).post("/api/v1/admin/uploads/signature").set(admin.authHeader).send({ kind: "source" });
    expect(res.body.data.uploadUrl).toBe("https://api.cloudinary.com/v1_1/themora-test/raw/upload");
    expect(res.body.data.fields).toMatchObject({ type: "authenticated", folder: "themora/source-files", api_key: "123456789" });
    expect(res.body.data.fields.signature).toMatch(/^[a-f0-9]{40}$/);
    expect(res.body.data.fields.api_secret).toBeUndefined();
  });

  it("lists the buyer's downloads with the latest version", async () => {
    const admin = await createTestAdmin();
    const buyer = await createTestUser();
    const product = await createProduct({ title: "Ledger" });
    await buy(buyer.user, product);
    await releaseVersion(admin.authHeader, product.id, "3.0");

    const res = await request(app).get("/api/v1/me/downloads").set(buyer.authHeader);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ licenseType: "SINGLE", latestVersion: { version: "3.0" } });
  });
});

describe("licences", () => {
  it("activates single licences on one domain and verifies publicly without personal data", async () => {
    const buyer = await createTestUser({ email: "secret-buyer@themora.test" });
    const product = await createProduct({ title: "Studio" });
    const { license } = await buy(buyer.user, product);
    const key = license.licenseKey;

    const first = await request(app).post("/api/v1/licenses/activate").send({ licenseKey: key, domain: "https://www.client-site.com/about" });
    expect(first.body.data).toEqual({ activated: true, domain: "client-site.com", alreadyActive: false });
    expect((await request(app).post("/api/v1/licenses/activate").send({ licenseKey: key, domain: "client-site.com" })).body.data.alreadyActive).toBe(true);
    expect((await request(app).post("/api/v1/licenses/activate").send({ licenseKey: key, domain: "second.com" })).status).toBe(409);

    const verify = await request(app).post("/api/v1/licenses/verify").send({ licenseKey: key.toLowerCase(), domain: "client-site.com" });
    expect(verify.body.data).toMatchObject({ valid: true, licenseType: "SINGLE", activationsUsed: 1, activationLimit: 1, activatedOnDomain: true });
    expect(JSON.stringify(verify.body)).not.toContain("secret-buyer");
    expect((await request(app).post("/api/v1/licenses/verify").send({ licenseKey: "THMR-0000-0000-0000" })).body.data).toEqual({ valid: false, reason: "not_found" });

    await request(app).post("/api/v1/licenses/deactivate").send({ licenseKey: key, domain: "client-site.com" });
    expect((await request(app).post("/api/v1/licenses/activate").send({ licenseKey: key, domain: "second.com" })).status).toBe(200);
  });

  it("upgrades single to extended for the price difference, keeping the same key", async () => {
    vi.spyOn(stripeGateway, "createSession").mockImplementation(async (order) => ({
      url: "https://checkout.stripe.com/c/pay/upgrade",
      sessionId: `cs_${order.orderNumber}`,
      chargeAmount: order.totalAmount,
      chargeCurrency: "USD",
    }));
    const buyer = await createTestUser();
    const product = await createProduct({ title: "Nimbus", price: 69, extendedPrice: 249 });
    const { license } = await buy(buyer.user, product);

    const list = await request(app).get("/api/v1/me/licenses").set(buyer.authHeader);
    expect(list.body.data[0]).toMatchObject({ canUpgrade: true, upgradePrice: 180, licenseType: "SINGLE" });

    const upgrade = await request(app).post(`/api/v1/me/licenses/${license.id}/upgrade`).set(buyer.authHeader).send({ gateway: "stripe" });
    expect(upgrade.status).toBe(201);
    expect(upgrade.body.data.upgradePrice).toBe(180);

    await fulfillmentService.fulfillOrder(upgrade.body.data.orderId, { provider: "STRIPE", amount: 180, currency: "USD" });
    const upgraded = await prisma.license.findUniqueOrThrow({ where: { id: license.id } });
    expect(upgraded).toMatchObject({ licenseType: "EXTENDED", activationLimit: null, licenseKey: license.licenseKey });
    expect(await prisma.license.count({ where: { templateId: product.id } })).toBe(1);
    expect((await prisma.template.findUnique({ where: { id: product.id } }))?.totalPurchase).toBe(1);

    const again = await request(app).post(`/api/v1/me/licenses/${license.id}/upgrade`).set(buyer.authHeader).send({ gateway: "stripe" });
    expect(again.status).toBe(400);
  });

  it("lets owners remove an activation but not other users", async () => {
    const buyer = await createTestUser();
    const other = await createTestUser();
    const { license } = await buy(buyer.user, await createProduct());
    await request(app).post("/api/v1/licenses/activate").send({ licenseKey: license.licenseKey, domain: "shop.com" });
    const activation = await prisma.licenseActivation.findFirstOrThrow({ where: { licenseId: license.id } });

    const path = `/api/v1/me/licenses/${license.id}/activations/${activation.id}`;
    expect((await request(app).delete(path).set(other.authHeader)).status).toBe(404);
    expect((await request(app).delete(path).set(buyer.authHeader)).status).toBe(200);
  });
});

describe("refunds", () => {
  it("accepts one request per order inside the refund window", async () => {
    const buyer = await createTestUser();
    const stranger = await createTestUser();
    const { order } = await buy(buyer.user, await createProduct());
    const { order: oldOrder } = await buy(buyer.user, await createProduct(), { paidDaysAgo: 30 });
    const reason = { reason: "The template does not support RTL layouts as I expected." };

    expect((await request(app).post(`/api/v1/me/orders/${order.id}/refund-request`).set(stranger.authHeader).send(reason)).status).toBe(404);
    expect((await request(app).post(`/api/v1/me/orders/${order.id}/refund-request`).set(buyer.authHeader).send(reason)).status).toBe(201);
    expect((await request(app).post(`/api/v1/me/orders/${order.id}/refund-request`).set(buyer.authHeader).send(reason)).status).toBe(409);
    const late = await request(app).post(`/api/v1/me/orders/${oldOrder.id}/refund-request`).set(buyer.authHeader).send(reason);
    expect(late.status).toBe(400);
    expect(late.body.message).toContain("14 days");
  });

  it("refunds through Stripe and revokes the licence", async () => {
    const refund = vi.spyOn(stripeGateway, "refund").mockResolvedValue({ id: "re_test_1" } as any);
    const admin = await createTestAdmin();
    const buyer = await createTestUser();
    const { order, license } = await buy(buyer.user, await createProduct());
    const created = await request(app)
      .post(`/api/v1/me/orders/${order.id}/refund-request`)
      .set(buyer.authHeader)
      .send({ reason: "Bought the wrong product by mistake, sorry!" });

    const approved = await request(app).post(`/api/v1/admin/refund-requests/${created.body.data.id}/approve`).set(admin.authHeader).send({ note: "Refunded" });
    expect(approved.status).toBe(200);
    expect(approved.body.data).toMatchObject({ status: "REFUNDED", providerRefundId: "re_test_1" });
    expect(refund).toHaveBeenCalledWith(`pi_${order.orderNumber}`);
    expect((await prisma.orderInvoice.findUnique({ where: { id: order.id } }))?.status).toBe("REFUNDED");
    expect((await prisma.license.findUnique({ where: { id: license.id } }))?.isActive).toBe(false);

    expect((await request(app).post(`/api/v1/admin/refund-requests/${created.body.data.id}/approve`).set(admin.authHeader).send({})).status).toBe(409);
  });

  it("marks SSLCommerz refund failures and allows a retry", async () => {
    const refund = vi
      .spyOn(sslcommerzGateway, "refund")
      .mockResolvedValueOnce({ status: "failed", errorReason: "Refund amount exceeds" })
      .mockResolvedValueOnce({ status: "success", refund_ref_id: "ssl_ref_1" });
    const admin = await createTestAdmin();
    const buyer = await createTestUser();
    const { order } = await buy(buyer.user, await createProduct(), { amount: 49, provider: "SSLCOMMERZ" });
    const created = await request(app)
      .post(`/api/v1/me/orders/${order.id}/refund-request`)
      .set(buyer.authHeader)
      .send({ reason: "Payment was made twice from my bKash account." });

    const failed = await request(app).post(`/api/v1/admin/refund-requests/${created.body.data.id}/approve`).set(admin.authHeader).send({});
    expect(failed.status).toBe(502);
    expect((await prisma.refundRequest.findUnique({ where: { id: created.body.data.id } }))?.status).toBe("FAILED");
    expect((await prisma.orderInvoice.findUnique({ where: { id: order.id } }))?.status).toBe("COMPLETED");

    const retried = await request(app).post(`/api/v1/admin/refund-requests/${created.body.data.id}/approve`).set(admin.authHeader).send({});
    expect(retried.body.data).toMatchObject({ status: "REFUNDED", providerRefundId: "ssl_ref_1" });
    expect(refund).toHaveBeenLastCalledWith(`bank_${order.orderNumber}`, 49 * 122, expect.any(String));
  });

  it("requires admins and an explanation to reject", async () => {
    const admin = await createTestAdmin();
    const buyer = await createTestUser();
    const { order } = await buy(buyer.user, await createProduct());
    const created = await request(app)
      .post(`/api/v1/me/orders/${order.id}/refund-request`)
      .set(buyer.authHeader)
      .send({ reason: "I changed my mind after downloading everything." });
    const path = `/api/v1/admin/refund-requests/${created.body.data.id}/reject`;

    expect((await request(app).post(path).set(buyer.authHeader).send({ note: "Nope, sorry" })).status).toBe(403);
    expect((await request(app).post(path).set(admin.authHeader).send({})).status).toBe(400);
    const rejected = await request(app).post(path).set(admin.authHeader).send({ note: "Files were downloaded, so this falls outside our policy." });
    expect(rejected.body.data.status).toBe("REJECTED");
    expect((await prisma.license.findFirst({ where: { orderId: order.id } }))?.isActive).toBe(true);
  });
});

describe("buyer orders", () => {
  it("lists my orders with items, licences and refund eligibility", async () => {
    const buyer = await createTestUser();
    const product = await createProduct();
    const { order, license } = await buy(buyer.user, product);
    const { order: oldOrder } = await buy(buyer.user, await createProduct(), { paidDaysAgo: 30 });
    await request(app)
      .post(`/api/v1/me/orders/${order.id}/refund-request`)
      .set(buyer.authHeader)
      .send({ reason: "The template does not support RTL layouts as I expected." });

    const res = await request(app).get("/api/v1/me/orders").set(buyer.authHeader);
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(2);
    const recent = res.body.data.find((o: any) => o.id === order.id);
    expect(recent.items[0]).toMatchObject({ title: `${product.title} (Single licence)`, product: { id: product.id } });
    expect(recent.licenses[0].licenseKey).toBe(license.licenseKey);
    // An open request blocks a second one
    expect(recent.refundRequest.status).toBe("REQUESTED");
    expect(recent.canRequestRefund).toBe(false);
    const old = res.body.data.find((o: any) => o.id === oldOrder.id);
    expect(old.canRequestRefund).toBe(false);
    expect(new Date(old.refundableUntil).getTime()).toBeLessThan(Date.now());

    const one = await request(app).get(`/api/v1/me/orders/${order.id}`).set(buyer.authHeader);
    expect(one.status).toBe(200);
    expect(one.body.data.orderNumber).toBe(order.orderNumber);
  });

  it("shows legacy single-product orders as one line", async () => {
    const buyer = await createTestUser();
    const product = await createProduct();
    await prisma.orderInvoice.create({
      data: { userId: buyer.user.id, templateId: product.id, orderNumber: "LEGACY-1", status: "COMPLETED", totalAmount: 49, licenseType: "SINGLE", customerEmail: buyer.user.email },
    });
    const res = await request(app).get("/api/v1/me/orders").set(buyer.authHeader);
    expect(res.body.data[0].items).toHaveLength(1);
    expect(res.body.data[0].items[0]).toMatchObject({ title: product.title, total: 49, product: { id: product.id } });
  });

  it("never shows full order details to anonymous visitors or other customers", async () => {
    const buyer = await createTestUser();
    const stranger = await createTestUser();
    const support = await createTestUser({ role: "SUPPORT" });
    const { order } = await buy(buyer.user, await createProduct());

    expect((await request(app).get(`/api/v1/orders/${order.id}`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/orders/${order.id}`).set(stranger.authHeader)).status).toBe(404);
    expect((await request(app).get(`/api/v1/me/orders/${order.id}`).set(stranger.authHeader)).status).toBe(404);
    expect((await request(app).get(`/api/v1/orders/${order.id}`).set(buyer.authHeader)).status).toBe(200);
    expect((await request(app).get(`/api/v1/orders/${order.id}`).set(support.authHeader)).status).toBe(200);
  });
});
