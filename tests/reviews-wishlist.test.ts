import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../src/app";
import { createTestAdmin, createTestUser, prisma, resetDatabase } from "./helpers/db";
import { createCompletedOrder, createProduct } from "./helpers/factories";

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

const review = (rating: number) => ({ rating, title: "Solid kit", body: "Clean code, great docs, saved me weeks." });

describe("product reviews", () => {
  it("lets a buyer review once, marks them verified and updates the rating", async () => {
    const product = await createProduct({ slug: "nimbus" });
    const { user, authHeader } = await createTestUser();
    await createCompletedOrder(user.id, product.id);

    const res = await request(app).post("/api/v1/products/nimbus/reviews").set(authHeader).send(review(4));
    expect(res.status).toBe(201);
    expect(res.body.data.isVerifiedBuyer).toBe(true);

    const again = await request(app).post("/api/v1/products/nimbus/reviews").set(authHeader).send(review(5));
    expect(again.status).toBe(409);

    const stored = await prisma.template.findUnique({ where: { id: product.id } });
    expect(stored).toMatchObject({ avgRating: 4, reviewCount: 1 });
  });

  it("blocks reviews on paid products from non-buyers but allows them on free products", async () => {
    await createProduct({ slug: "paid" });
    await createProduct({ slug: "free", isFree: true, price: 0 });
    const { authHeader } = await createTestUser();

    expect((await request(app).post("/api/v1/products/paid/reviews").set(authHeader).send(review(5))).status).toBe(403);
    const free = await request(app).post("/api/v1/products/free/reviews").set(authHeader).send(review(5));
    expect(free.status).toBe(201);
    expect(free.body.data.isVerifiedBuyer).toBe(false);
  });

  it("requires login and validates input", async () => {
    await createProduct({ slug: "free", isFree: true, price: 0 });
    expect((await request(app).post("/api/v1/products/free/reviews").send(review(5))).status).toBe(401);

    const { authHeader } = await createTestUser();
    const res = await request(app).post("/api/v1/products/free/reviews").set(authHeader).send({ rating: 6, body: "short" });
    expect(res.status).toBe(400);
  });

  it("returns reviews with a rating breakdown and supports sorting", async () => {
    const product = await createProduct({ slug: "free", isFree: true, price: 0 });
    for (const rating of [5, 5, 3]) {
      const { authHeader } = await createTestUser();
      await request(app).post("/api/v1/products/free/reviews").set(authHeader).send(review(rating));
    }

    const res = await request(app).get("/api/v1/products/free/reviews?sort=lowest");
    expect(res.status).toBe(200);
    expect(res.body.data.map((r: any) => r.rating)).toEqual([3, 5, 5]);
    expect(res.body.summary).toEqual({
      avgRating: 4.3,
      reviewCount: 3,
      breakdown: { 5: 2, 4: 0, 3: 1, 2: 0, 1: 0 },
    });
    expect(res.body.data[0].user.fullName).toBe("Test User");
    expect(res.body.data[0].user.email).toBeUndefined();
    expect((await prisma.template.findUnique({ where: { id: product.id } }))?.avgRating).toBe(4.3);
  });

  it("lets owners edit and delete, and blocks other users", async () => {
    await createProduct({ slug: "free", isFree: true, price: 0 });
    const owner = await createTestUser();
    const stranger = await createTestUser();
    const created = await request(app).post("/api/v1/products/free/reviews").set(owner.authHeader).send(review(2));
    const id = created.body.data.id;

    expect((await request(app).patch(`/api/v1/reviews/${id}`).set(stranger.authHeader).send({ rating: 1 })).status).toBe(403);
    const edited = await request(app).patch(`/api/v1/reviews/${id}`).set(owner.authHeader).send({ rating: 5 });
    expect(edited.body.data.rating).toBe(5);

    expect((await request(app).delete(`/api/v1/reviews/${id}`).set(stranger.authHeader)).status).toBe(403);
    expect((await request(app).delete(`/api/v1/reviews/${id}`).set(owner.authHeader)).status).toBe(200);
    expect(await prisma.template.findFirst({ where: { slug: "free" } })).toMatchObject({ reviewCount: 0, avgRating: 0 });
  });

  it("lets admins hide reviews (removing them from the rating) and reply", async () => {
    const product = await createProduct({ slug: "free", isFree: true, price: 0 });
    const { authHeader } = await createTestUser();
    const admin = await createTestAdmin();
    const created = await request(app).post("/api/v1/products/free/reviews").set(authHeader).send(review(1));
    const id = created.body.data.id;

    const hidden = await request(app).patch(`/api/v1/admin/reviews/${id}/status`).set(admin.authHeader).send({ status: "HIDDEN" });
    expect(hidden.status).toBe(200);
    expect(await prisma.template.findUnique({ where: { id: product.id } })).toMatchObject({ reviewCount: 0 });
    expect((await request(app).get("/api/v1/products/free/reviews")).body.data).toEqual([]);

    expect((await request(app).post(`/api/v1/reviews/${id}/replies`).set(authHeader).send({ body: "Me too" })).status).toBe(403);
    const reply = await request(app).post(`/api/v1/reviews/${id}/replies`).set(admin.authHeader).send({ body: "Thanks, we fixed this in v1.2" });
    expect(reply.status).toBe(201);

    const list = await request(app).get("/api/v1/admin/reviews?status=HIDDEN").set(admin.authHeader);
    expect(list.body.data[0].replies[0].body).toBe("Thanks, we fixed this in v1.2");
  });
});

describe("wishlist", () => {
  it("adds (idempotently), lists and removes products", async () => {
    const product = await createProduct({ title: "Pulse" });
    const { authHeader } = await createTestUser();

    expect((await request(app).post("/api/v1/me/wishlist").set(authHeader).send({ productId: product.id })).status).toBe(201);
    expect((await request(app).post("/api/v1/me/wishlist").set(authHeader).send({ productId: product.id })).status).toBe(201);

    const list = await request(app).get("/api/v1/me/wishlist").set(authHeader);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].title).toBe("Pulse");

    const ids = await request(app).get("/api/v1/me/wishlist/ids").set(authHeader);
    expect(ids.body.data).toEqual([product.id]);

    await request(app).delete(`/api/v1/me/wishlist/${product.id}`).set(authHeader);
    expect((await request(app).get("/api/v1/me/wishlist").set(authHeader)).body.data).toEqual([]);
  });

  it("rejects unknown or unpublished products and requires login", async () => {
    const draft = await createProduct({ status: "DRAFT" });
    const { authHeader } = await createTestUser();
    expect((await request(app).post("/api/v1/me/wishlist").set(authHeader).send({ productId: draft.id })).status).toBe(404);
    expect((await request(app).get("/api/v1/me/wishlist")).status).toBe(401);
  });
});
