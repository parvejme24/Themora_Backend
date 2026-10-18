import express from "express";
import request from "supertest";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "../src/utils/AppError";
import { asyncHandler } from "../src/utils/asyncHandler";
import { buildPaginationMeta, parsePagination } from "../src/utils/pagination";
import { sendResponse } from "../src/utils/sendResponse";
import { validateRequest } from "../src/utils/validateRequest";
import { errorHandler } from "../src/middleware/errorHandler";

describe("parsePagination", () => {
  it("uses defaults for missing or invalid values", () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 12, skip: 0, take: 12 });
    expect(parsePagination({ page: "-3", limit: "abc" })).toEqual({ page: 1, limit: 12, skip: 0, take: 12 });
  });

  it("clamps limit to maxLimit and computes skip", () => {
    expect(parsePagination({ page: "3", limit: "500" }, { maxLimit: 50 })).toEqual({
      page: 3,
      limit: 50,
      skip: 100,
      take: 50,
    });
  });
});

describe("buildPaginationMeta", () => {
  it("computes page flags", () => {
    expect(buildPaginationMeta(25, 2, 10)).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasNext: true,
      hasPrev: true,
    });
  });

  it("reports one page when empty", () => {
    expect(buildPaginationMeta(0, 1, 10)).toMatchObject({ totalPages: 1, hasNext: false, hasPrev: false });
  });
});

describe("validateRequest + errorHandler", () => {
  const app = express();
  app.use(express.json());
  app.post(
    "/items/:id",
    validateRequest({
      params: z.object({ id: z.string().uuid() }),
      body: z.object({ title: z.string().min(3) }),
    }),
    (req, res) => sendResponse(res, { statusCode: 201, message: "Created", data: (req as any).validatedData })
  );
  app.get(
    "/boom/:kind",
    asyncHandler(async (req) => {
      if (req.params.kind === "app") throw AppError.notFound("Item not found");
      if (req.params.kind === "unique") {
        throw new Prisma.PrismaClientKnownRequestError("Unique failed", {
          code: "P2002",
          clientVersion: "test",
          meta: { target: ["email"] },
        });
      }
      throw new Error("secret internals");
    })
  );
  app.use(errorHandler);

  const id = "6f1c2c1e-6c1a-4d8e-9a8b-2f6f0e4c1a11";

  it("passes valid input through with the standard envelope", async () => {
    const res = await request(app).post(`/items/${id}`).send({ title: "Nimbus" });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, message: "Created", data: { title: "Nimbus" } });
  });

  it("returns 400 with field paths for invalid input", async () => {
    const res = await request(app).post("/items/not-a-uuid").send({ title: "x" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(res.body.errors[0].path).toBe("id");
  });

  it("maps AppError to its status", async () => {
    const res = await request(app).get("/boom/app");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: "Item not found" });
  });

  it("maps Prisma unique violations to 409", async () => {
    const res = await request(app).get("/boom/unique");
    expect(res.status).toBe(409);
    expect(res.body.message).toContain("email");
  });

  it("turns unknown errors into a 500", async () => {
    const res = await request(app).get("/boom/other");
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Internal Server Error");
  });
});
