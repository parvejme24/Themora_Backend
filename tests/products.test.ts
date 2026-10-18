import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../src/app";
import { createTestAdmin, createTestUser, prisma, resetDatabase } from "./helpers/db";
import { createCategory, createCompletedOrder, createProduct } from "./helpers/factories";

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

const validProduct = (categoryId: string) => ({
  title: "Nimbus — Next.js 15 SaaS Starter",
  shortDescription: "Launch your SaaS in days with auth, billing, teams and an admin panel.",
  productType: "WEBSITE_TEMPLATE",
  status: "PUBLISHED",
  categoryId,
  price: 69,
  extendedPrice: 249,
  techStack: ["Next.js", "Tailwind CSS", "Prisma"],
  platforms: ["Web"],
  tags: ["SaaS", "Starter Kit"],
  keyFeatures: [{ title: "Stripe billing", description: "Subscriptions and invoices" }],
  imageUrl: "https://picsum.photos/seed/nimbus/1200/800",
});

describe("public product listing", () => {
  it("lists only published products with pagination", async () => {
    const category = await createCategory();
    await createProduct({ categoryId: category.id, title: "Live One" });
    await createProduct({ categoryId: category.id, title: "Draft One", status: "DRAFT" });
    await createProduct({ categoryId: category.id, title: "Old One", status: "ARCHIVED" });

    const res = await request(app).get("/api/v1/products");
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: any) => p.title)).toEqual(["Live One"]);
    expect(res.body.pagination).toMatchObject({ total: 1, page: 1 });
    expect(res.body.data[0].sourceFiles).toBeUndefined();
  });

  it("filters by type, tech, platform, free, price and category", async () => {
    const mobile = await createCategory({ slug: "mobile-apps", title: "Mobile Apps" });
    const web = await createCategory({ slug: "saas", title: "SaaS" });
    await createProduct({ categoryId: mobile.id, title: "FoodDash", productType: "MOBILE_APP", techStack: ["Flutter"], platforms: ["iOS", "Android"], price: 49 });
    await createProduct({ categoryId: web.id, title: "Nimbus", techStack: ["Next.js"], platforms: ["Web"], price: 69 });
    await createProduct({ categoryId: web.id, title: "Freebie", techStack: ["HTML"], isFree: true, price: 0 });

    const titles = async (qs: string) =>
      (await request(app).get(`/api/v1/products?${qs}`)).body.data.map((p: any) => p.title).sort();

    expect(await titles("type=MOBILE_APP")).toEqual(["FoodDash"]);
    expect(await titles("tech=Next.js,Flutter")).toEqual(["FoodDash", "Nimbus"]);
    expect(await titles("platform=Android")).toEqual(["FoodDash"]);
    expect(await titles("free=true")).toEqual(["Freebie"]);
    expect(await titles("minPrice=50&maxPrice=100")).toEqual(["Nimbus"]);
    expect(await titles("category=saas")).toEqual(["Freebie", "Nimbus"]);
    expect(await titles("q=food")).toEqual(["FoodDash"]);
  });

  it("sorts by price and best-selling", async () => {
    const category = await createCategory();
    await createProduct({ categoryId: category.id, title: "Cheap", price: 10, totalPurchase: 5 });
    await createProduct({ categoryId: category.id, title: "Pricey", price: 99, totalPurchase: 50 });

    const asc = await request(app).get("/api/v1/products?sort=price_asc");
    expect(asc.body.data.map((p: any) => p.title)).toEqual(["Cheap", "Pricey"]);
    const best = await request(app).get("/api/v1/products?sort=bestselling");
    expect(best.body.data[0].title).toBe("Pricey");
  });

  it("rejects invalid query values", async () => {
    const res = await request(app).get("/api/v1/products?type=SPACESHIP");
    expect(res.status).toBe(400);
  });

  it("returns facets for the filter sidebar", async () => {
    const category = await createCategory({ slug: "apps", title: "Apps" });
    await createProduct({ categoryId: category.id, productType: "MOBILE_APP", techStack: ["Flutter", "Firebase"], platforms: ["Android"] });
    await createProduct({ categoryId: category.id, productType: "MOBILE_APP", techStack: ["Flutter"], price: 99 });
    await createProduct({ categoryId: category.id, status: "DRAFT", techStack: ["Secret"] });

    const res = await request(app).get("/api/v1/products/facets");
    expect(res.status).toBe(200);
    expect(res.body.data.types).toEqual([{ value: "MOBILE_APP", count: 2 }]);
    expect(res.body.data.techStack[0]).toEqual({ value: "Flutter", count: 2 });
    expect(res.body.data.techStack.find((t: any) => t.value === "Secret")).toBeUndefined();
    expect(res.body.data.categories).toEqual([{ id: category.id, title: "Apps", slug: "apps", count: 2 }]);
    expect(res.body.data.price).toEqual({ min: 49, max: 99 });
  });
});

describe("product detail", () => {
  it("fetches by slug or id, hides source files, and counts views", async () => {
    const product = await createProduct({ slug: "nimbus", sourceFiles: ["a.zip", "b.zip"] });

    const bySlug = await request(app).get("/api/v1/products/nimbus");
    expect(bySlug.status).toBe(200);
    expect(bySlug.body.data.sourceFiles).toBeUndefined();
    expect(bySlug.body.data.sourceFileCount).toBe(2);

    const byId = await request(app).get(`/api/v1/products/${product.id}`);
    expect(byId.body.data.slug).toBe("nimbus");

    await new Promise((resolve) => setTimeout(resolve, 300));
    const updated = await prisma.template.findUnique({ where: { id: product.id } });
    expect(updated?.viewCount).toBeGreaterThanOrEqual(1);
  });

  it("returns 404 for drafts", async () => {
    await createProduct({ slug: "secret-draft", status: "DRAFT" });
    const res = await request(app).get("/api/v1/products/secret-draft");
    expect(res.status).toBe(404);
  });

  it("returns related products from the same category", async () => {
    const category = await createCategory();
    const other = await createCategory();
    await createProduct({ categoryId: category.id, slug: "main" });
    await createProduct({ categoryId: category.id, title: "Sibling" });
    await createProduct({ categoryId: other.id, title: "Stranger", productType: "PLUGIN" });

    const res = await request(app).get("/api/v1/products/main/related");
    expect(res.body.data.map((p: any) => p.title)).toEqual(["Sibling"]);
  });
});

describe("admin product management", () => {
  it("creates a product with tags and an auto slug, and bumps the category count", async () => {
    const { authHeader } = await createTestAdmin();
    const category = await createCategory();

    const res = await request(app).post("/api/v1/admin/products").set(authHeader).send(validProduct(category.id));
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe("nimbus-next-js-15-saas-starter");
    expect(res.body.data.tags.map((t: any) => t.slug).sort()).toEqual(["saas", "starter-kit"]);
    expect(res.body.data.publishedAt).not.toBeNull();

    const updatedCategory = await prisma.templateCategory.findUnique({ where: { id: category.id } });
    expect(updatedCategory?.templateCount).toBe(1);
  });

  it("validates prices", async () => {
    const { authHeader } = await createTestAdmin();
    const category = await createCategory();

    const res = await request(app)
      .post("/api/v1/admin/products")
      .set(authHeader)
      .send({ ...validProduct(category.id), salePrice: 99 });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].path).toBe("salePrice");
  });

  it("rejects duplicate slugs with 409", async () => {
    const { authHeader } = await createTestAdmin();
    const category = await createCategory();
    await createProduct({ slug: "taken" });

    const res = await request(app)
      .post("/api/v1/admin/products")
      .set(authHeader)
      .send({ ...validProduct(category.id), slug: "taken" });
    expect(res.status).toBe(409);
  });

  it("updates only the fields sent and replaces tags", async () => {
    const { authHeader } = await createTestAdmin();
    const category = await createCategory();
    const created = await request(app).post("/api/v1/admin/products").set(authHeader).send(validProduct(category.id));

    const res = await request(app)
      .patch(`/api/v1/admin/products/${created.body.data.id}`)
      .set(authHeader)
      .send({ price: 79, tags: ["Boilerplate"] });
    expect(res.status).toBe(200);
    expect(res.body.data.price).toBe(79);
    expect(res.body.data.techStack).toEqual(["Next.js", "Tailwind CSS", "Prisma"]);
    expect(res.body.data.tags).toEqual([{ name: "Boilerplate", slug: "boilerplate" }]);
  });

  it("archives products that have orders instead of deleting them", async () => {
    const { authHeader } = await createTestAdmin();
    const { user } = await createTestUser();
    const sold = await createProduct();
    const unsold = await createProduct();
    await createCompletedOrder(user.id, sold.id);

    const archived = await request(app).delete(`/api/v1/admin/products/${sold.id}`).set(authHeader);
    expect(archived.body.data).toEqual({ archived: true });
    expect((await prisma.template.findUnique({ where: { id: sold.id } }))?.status).toBe("ARCHIVED");

    const deleted = await request(app).delete(`/api/v1/admin/products/${unsold.id}`).set(authHeader);
    expect(deleted.body.data).toEqual({ archived: false });
    expect(await prisma.template.findUnique({ where: { id: unsold.id } })).toBeNull();
  });

  it("lists drafts for admins only", async () => {
    await createProduct({ status: "DRAFT", title: "Hidden" });
    const { authHeader: userHeader } = await createTestUser();
    const { authHeader } = await createTestAdmin();

    expect((await request(app).get("/api/v1/admin/products").set(userHeader)).status).toBe(403);
    const res = await request(app).get("/api/v1/admin/products?status=DRAFT").set(authHeader);
    expect(res.body.data.map((p: any) => p.title)).toEqual(["Hidden"]);
  });

  it("keeps legacy /templates creation working by generating a slug", async () => {
    const { authHeader } = await createTestAdmin();
    const category = await createCategory();
    const res = await request(app)
      .post("/api/v1/templates")
      .set(authHeader)
      .send({ title: "Legacy Theme", price: 20, shortDescription: "Created through the old endpoint", categoryId: category.id });
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe("legacy-theme");
  });
});
