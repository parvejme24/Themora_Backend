import crypto from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/utils/email", () => ({
  sendRefundDecisionEmail: vi.fn().mockResolvedValue(undefined),
}));

import app from "../src/app";
import { fulfillmentService } from "../src/module/payment/fulfillment.service";
import { stripeGateway } from "../src/module/payment/gateways/stripe.gateway";
import { createTestAdmin, createTestUser, prisma, resetDatabase } from "./helpers/db";
import { createCompletedOrder, createProduct } from "./helpers/factories";

beforeEach(resetDatabase);
afterEach(() => vi.restoreAllMocks());
afterAll(() => prisma.$disconnect());

// A paid Stripe cart order with one item and its licence
const buy = async (user: { id: string; email: string }, product: { id: string; title: string }, amount = 69) => {
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
      customerName: "Rahim Uddin",
      items: { create: [{ productId: product.id, title: `${product.title} (Single licence)`, unitPrice: amount, total: amount }] },
    },
  });
  await fulfillmentService.fulfillOrder(order.id, { provider: "STRIPE", providerPaymentId: `pi_${order.orderNumber}`, amount, currency: "USD" });
  return order;
};

describe("admin orders", () => {
  it("lists orders with line items, filters, search and per-status counts", async () => {
    const admin = await createTestAdmin();
    const buyer = await createTestUser();
    const cartOrder = await buy(buyer.user, await createProduct({ title: "Nimbus" }));
    const legacy = await createCompletedOrder(buyer.user.id, (await createProduct({ title: "Old Theme" })).id, "legacy@themora.test");
    await prisma.orderInvoice.create({
      data: { orderNumber: "TEST-PENDING", status: "PENDING", licenseType: "SINGLE", totalAmount: 10, customerEmail: "someone@themora.test" },
    });

    const all = await request(app).get("/api/v1/admin/orders").set(admin.authHeader);
    expect(all.status).toBe(200);
    expect(all.body.pagination.total).toBe(3);
    expect(all.body.counts).toEqual({ COMPLETED: 2, PENDING: 1 });
    const byId = Object.fromEntries(all.body.data.map((order: any) => [order.id, order]));
    expect(byId[cartOrder.id]).toMatchObject({ firstItem: "Nimbus (Single licence)", itemCount: 1, provider: "STRIPE", refundStatus: null });
    expect(byId[legacy.id]).toMatchObject({ firstItem: "Old Theme", itemCount: 1 });

    const completed = await request(app).get("/api/v1/admin/orders?status=COMPLETED").set(admin.authHeader);
    expect(completed.body.data).toHaveLength(2);
    expect(completed.body.counts).toEqual({ COMPLETED: 2, PENDING: 1 });

    const search = await request(app).get("/api/v1/admin/orders?q=LEGACY@").set(admin.authHeader);
    expect(search.body.data.map((order: any) => order.id)).toEqual([legacy.id]);
    const byNumber = await request(app).get(`/api/v1/admin/orders?q=${cartOrder.orderNumber.toLowerCase()}`).set(admin.authHeader);
    expect(byNumber.body.data.map((order: any) => order.id)).toEqual([cartOrder.id]);
  });

  it("shows the full order: items, licences, payment reference and buyer", async () => {
    const admin = await createTestAdmin();
    const buyer = await createTestUser();
    const order = await buy(buyer.user, await createProduct({ title: "Nimbus" }));

    const res = await request(app).get(`/api/v1/admin/orders/${order.id}`).set(admin.authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      orderNumber: order.orderNumber,
      status: "COMPLETED",
      providerPaymentId: `pi_${order.orderNumber}`,
      user: { id: buyer.user.id, email: buyer.user.email },
      items: [{ title: "Nimbus (Single licence)", total: 69 }],
      refundRequests: [],
    });
    expect(res.body.data.licenses).toHaveLength(1);
    expect(res.body.data.licenses[0]._count.activations).toBe(0);
    expect((await request(app).get(`/api/v1/admin/orders/${crypto.randomUUID()}`).set(admin.authHeader)).status).toBe(404);
  });

  it("staff refunds go through the gateway and revoke licences, even outside the buyer's window", async () => {
    const refund = vi.spyOn(stripeGateway, "refund").mockResolvedValue({ id: "re_staff_1" } as any);
    const support = await createTestUser({ role: "SUPPORT" });
    const buyer = await createTestUser();
    const order = await buy(buyer.user, await createProduct());
    await prisma.orderInvoice.update({ where: { id: order.id }, data: { paidAt: new Date(Date.now() - 60 * 86_400_000) } });

    const res = await request(app)
      .post(`/api/v1/admin/orders/${order.id}/refund`)
      .set(support.authHeader)
      .send({ reason: "Customer emailed: charged twice" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "REFUNDED", providerRefundId: "re_staff_1", adminNote: "Customer emailed: charged twice" });
    expect(refund).toHaveBeenCalledWith(`pi_${order.orderNumber}`);
    expect((await prisma.orderInvoice.findUnique({ where: { id: order.id } }))?.status).toBe("REFUNDED");
    expect(await prisma.license.count({ where: { orderId: order.id, isActive: true } })).toBe(0);

    const again = await request(app).post(`/api/v1/admin/orders/${order.id}/refund`).set(support.authHeader).send({ reason: "Again please" });
    expect(again.status).toBe(400);
  });

  it("approves the buyer's open request instead of creating a second one", async () => {
    vi.spyOn(stripeGateway, "refund").mockResolvedValue({ id: "re_staff_2" } as any);
    const admin = await createTestAdmin();
    const buyer = await createTestUser();
    const order = await buy(buyer.user, await createProduct());
    await request(app)
      .post(`/api/v1/me/orders/${order.id}/refund-request`)
      .set(buyer.authHeader)
      .send({ reason: "Bought the wrong product by mistake, sorry!" });

    const res = await request(app).post(`/api/v1/admin/orders/${order.id}/refund`).set(admin.authHeader).send({ reason: "Approved on request" });
    expect(res.status).toBe(200);
    expect(await prisma.refundRequest.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("is limited to staff with the support permission", async () => {
    const editor = await createTestUser({ role: "EDITOR" });
    const customer = await createTestUser();
    expect((await request(app).get("/api/v1/admin/orders").set(editor.authHeader)).status).toBe(403);
    expect((await request(app).get("/api/v1/admin/orders").set(customer.authHeader)).status).toBe(403);
  });
});
