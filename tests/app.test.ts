import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createTestAdmin, createTestUser, prisma, resetDatabase } from "./helpers/db";

beforeAll(resetDatabase);
afterAll(() => prisma.$disconnect());

describe("app basics", () => {
  it("GET / reports the server is running", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("running");
  });

  it("GET /health checks the database", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, database: "up" });
  });

  it("unknown routes return a JSON 404", async () => {
    const res = await request(app).get("/api/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: "Route not found" });
  });

  it("malformed JSON returns 400 instead of 500", async () => {
    const res = await request(app)
      .post("/api/v1/pricing")
      .set("Content-Type", "application/json")
      .send("{ not json");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, message: "Malformed JSON body" });
  });
});

describe("existing public endpoints work against the test schema", () => {
  it("GET /api/v1/templates returns an empty paginated list", async () => {
    const res = await request(app).get("/api/v1/templates");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination).toMatchObject({ page: 1, total: 0 });
  });

  it("GET /api/v1/template-categories responds", async () => {
    const res = await request(app).get("/api/v1/template-categories");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("GET /api/v1/pricing responds", async () => {
    const res = await request(app).get("/api/v1/pricing");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("authentication and roles", () => {
  it("rejects admin routes without a token", async () => {
    const res = await request(app).get("/api/v1/dashboard/overview");
    expect(res.status).toBe(401);
  });

  it("rejects admin routes for a normal user", async () => {
    const { authHeader } = await createTestUser();
    const res = await request(app).get("/api/v1/dashboard/overview").set(authHeader);
    expect(res.status).toBe(403);
  });

  it("rejects banned users", async () => {
    const { authHeader } = await createTestAdmin({ isBanned: true });
    const res = await request(app).get("/api/v1/dashboard/overview").set(authHeader);
    expect(res.status).toBe(403);
  });

  it("allows admins", async () => {
    const { authHeader } = await createTestAdmin();
    const res = await request(app).get("/api/v1/dashboard/overview").set(authHeader);
    expect(res.status).toBe(200);
  });
});
