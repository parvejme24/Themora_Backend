import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../src/app";
import { parseCsv, toCsv } from "../src/utils/csv";
import { createTestAdmin, createTestUser, prisma, resetDatabase } from "./helpers/db";
import { createCategory, createProduct } from "./helpers/factories";

afterAll(() => prisma.$disconnect());

describe("csv utils", () => {
  it("round-trips commas, quotes, line breaks and formula-like values", () => {
    const rows = [
      ["a", "b, c", 'say "hi"'],
      ["line one\nline two", "=SUM(A1)", "-5", ""],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it("escapes formula-like cells for spreadsheets", () => {
    expect(toCsv([["=1+1", "@cmd"]])).toBe("﻿'=1+1,'@cmd\r\n");
  });

  it("reads CRLF and LF files, skips blank lines and rejects unclosed quotes", () => {
    expect(parseCsv("a,b\r\n\r\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
    expect(() => parseCsv('a,"b\n1,2')).toThrow(/never closed/);
  });
});

describe("product CSV import / export", () => {
  beforeEach(resetDatabase);

  const importCsv = (authHeader: Record<string, string>, csv: string, dryRun = false) =>
    request(app).post("/api/v1/admin/products/import").set(authHeader).send({ csv, dryRun });

  it("exports products with every editable field, filtered like the admin list", async () => {
    const { authHeader } = await createTestAdmin();
    const category = await createCategory({ slug: "saas", title: "SaaS" });
    await createProduct({
      categoryId: category.id,
      title: "Nimbus, the SaaS kit",
      slug: "nimbus",
      techStack: ["Next.js", "Prisma"],
      description: ["First paragraph.", "Second paragraph."],
      keyFeatures: [{ title: "Billing", description: "Stripe subscriptions" }],
      extendedPrice: 199,
    });
    await createProduct({ categoryId: category.id, slug: "draft-one", status: "DRAFT" });

    const res = await request(app).get("/api/v1/admin/products/export?status=PUBLISHED").set(authHeader);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename="themora-products-/);

    const [header, ...rows] = parseCsv(res.text);
    expect(rows).toHaveLength(1);
    const row = Object.fromEntries(header.map((name, index) => [name, rows[0][index]]));
    expect(row).toMatchObject({
      slug: "nimbus",
      title: "Nimbus, the SaaS kit",
      category: "saas",
      techStack: "Next.js | Prisma",
      description: "First paragraph.\n\nSecond paragraph.",
      keyFeatures: "Billing :: Stripe subscriptions",
      extendedPrice: "199",
      salePrice: "",
    });
  });

  it("re-importing an unchanged export changes nothing", async () => {
    const { authHeader } = await createTestAdmin();
    const category = await createCategory({ slug: "apps" });
    const product = await createProduct({
      categoryId: category.id,
      slug: "fooddash",
      techStack: ["Flutter"],
      platforms: ["iOS", "Android"],
      whatsIncluded: ["Source code", "Docs"],
      keyFeatures: [{ title: "Live tracking", description: "Maps: real time" }],
      tags: { create: [{ name: "Food", slug: "food" }] },
      saleEndsAt: new Date("2030-01-01T00:00:00.000Z"),
      salePrice: 29,
    });
    const before = await prisma.template.findUnique({ where: { id: product.id }, include: { tags: true } });

    const exported = await request(app).get("/api/v1/admin/products/export").set(authHeader);
    const res = await importCsv(authHeader, exported.text);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ created: 0, updated: 1 });

    const after = await prisma.template.findUnique({ where: { id: product.id }, include: { tags: true } });
    const { updatedAt: _a, ...beforeRest } = before!;
    const { updatedAt: _b, ...afterRest } = after!;
    expect(afterRest).toEqual(beforeRest);
  });

  it("creates new rows and updates rows matched by id or slug", async () => {
    const { authHeader } = await createTestAdmin();
    const category = await createCategory({ slug: "ui-kits" });
    const byId = await createProduct({ categoryId: category.id, slug: "old-one", price: 10 });
    await createProduct({ categoryId: category.id, slug: "by-slug", price: 20, isFeatured: false });

    const csv = toCsv([
      ["id", "slug", "title", "category", "price", "shortDescription", "isFeatured", "tags", "keyFeatures"],
      [byId.id, "", "", "", "15", "", "", "", ""],
      ["", "by-slug", "", "", "", "", "yes", "", ""],
      ["", "", "Orbit UI Kit", "ui-kits", "39", "A clean Figma UI kit with 300 components.", "", "Figma | Dashboard", "Auto layout :: Every component\nDark mode"],
    ]);

    const res = await importCsv(authHeader, csv);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ created: 1, updated: 2, dryRun: false });

    expect((await prisma.template.findUnique({ where: { id: byId.id } }))!.price).toBe(15);
    expect((await prisma.template.findUnique({ where: { slug: "by-slug" } }))!).toMatchObject({ isFeatured: true, price: 20 });
    const created = await prisma.template.findUnique({ where: { slug: "orbit-ui-kit" }, include: { tags: true } });
    expect(created).toMatchObject({ status: "DRAFT", price: 39, categoryId: category.id });
    expect(created!.tags.map((tag) => tag.name).sort()).toEqual(["Dashboard", "Figma"]);
    expect(created!.keyFeatures).toEqual([
      { title: "Auto layout", description: "Every component" },
      { title: "Dark mode", description: "" },
    ]);
    expect((await prisma.templateCategory.findUnique({ where: { id: category.id } }))!.templateCount).toBe(1);
  });

  it("dry run previews without writing", async () => {
    const { authHeader } = await createTestAdmin();
    await createCategory({ slug: "themes" });
    const csv = toCsv([
      ["title", "category", "price", "shortDescription"],
      ["Aurora Theme", "themes", "29", "A fast, accessible landing page theme."],
    ]);

    const res = await importCsv(authHeader, csv, true);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ dryRun: true, created: 1, updated: 0, rows: [{ row: 2, action: "create", title: "Aurora Theme" }] });
    expect(await prisma.template.count()).toBe(0);
  });

  it("reports every bad row and writes nothing when any row is invalid", async () => {
    const { authHeader } = await createTestAdmin();
    await createCategory({ slug: "themes" });
    const csv = toCsv([
      ["id", "title", "category", "price", "shortDescription", "isFree", "salePrice"],
      ["", "Good Theme", "themes", "29", "A perfectly valid theme description.", "", ""],
      ["", "Bad Category", "nope", "29", "A perfectly valid theme description.", "", ""],
      ["", "Bad Price", "themes", "cheap", "A perfectly valid theme description.", "maybe", "40"],
      ["00000000-0000-0000-0000-000000000000", "", "", "", "", "", ""],
      ["", "No Category", "", "10", "A perfectly valid theme description.", "", ""],
    ]);

    const res = await importCsv(authHeader, csv);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/4 of 5 rows have problems/);
    const problems = res.body.errors.map((error: any) => `${error.row}:${error.column}`);
    expect(problems).toEqual(expect.arrayContaining(["3:category", "4:price", "4:isFree", "5:id", "6:category"]));
    expect(await prisma.template.count()).toBe(0);
  });

  it("rejects unknown columns, duplicate products and oversized files", async () => {
    const { authHeader } = await createTestAdmin();
    const category = await createCategory({ slug: "themes" });
    await createProduct({ categoryId: category.id, slug: "taken" });

    const unknown = await importCsv(authHeader, "title,prise\nX,1\n");
    expect(unknown.status).toBe(400);
    expect(unknown.body.message).toMatch(/Unknown columns: prise/);

    const duplicate = await importCsv(authHeader, toCsv([["slug", "price"], ["taken", "5"], ["taken", "6"]]));
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.errors).toEqual([{ row: 3, column: "slug", message: "Same product as row 2" }]);

    const many = toCsv([["title"], ...Array.from({ length: 501 }, (_, i) => [`Product ${i}`])]);
    const tooMany = await importCsv(authHeader, many);
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.message).toMatch(/at most 500/);
  });

  it("is limited to staff who can edit the catalogue", async () => {
    const editor = await createTestUser({ role: "EDITOR" });
    const support = await createTestUser({ role: "SUPPORT" });
    const customer = await createTestUser();

    expect((await request(app).get("/api/v1/admin/products/export").set(editor.authHeader)).status).toBe(200);
    expect((await request(app).get("/api/v1/admin/products/export").set(support.authHeader)).status).toBe(403);
    expect((await importCsv(customer.authHeader, "title\nX\n")).status).toBe(403);
  });
});
