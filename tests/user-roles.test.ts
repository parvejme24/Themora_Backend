import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import app from "../src/app";
import { createTestAdmin, createTestUser, prisma, resetDatabase } from "./helpers/db";

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

const setRole = (authHeader: Record<string, string>, id: string, role: string) =>
  request(app).patch(`/api/v1/auth/users/${id}/role`).set(authHeader).send({ role });

describe("user roles", () => {
  it("admins can give and remove staff roles, and the change is audited", async () => {
    const admin = await createTestAdmin();
    const member = await createTestUser();

    for (const role of ["SUPPORT", "EDITOR", "MODERATOR", "USER"]) {
      const res = await setRole(admin.authHeader, member.user.id, role);
      expect(res.status).toBe(200);
      expect((await prisma.user.findUnique({ where: { id: member.user.id } }))?.role).toBe(role);
    }

    const filtered = await request(app).get("/api/v1/auth/users?role=EDITOR").set(admin.authHeader);
    expect(filtered.status).toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 300)); // audit entries are written after the response
    const audits = await prisma.auditLog.findMany({ where: { entityType: "users", entityId: member.user.id } });
    expect(audits.some((entry) => (entry.metadata as any)?.from === "USER" && (entry.metadata as any)?.to === "SUPPORT")).toBe(true);
  });

  it("rejects unknown roles and self-demotion; another admin can be demoted", async () => {
    const admin = await createTestAdmin();
    const member = await createTestUser();

    expect((await setRole(admin.authHeader, member.user.id, "SUPER_ADMIN")).status).toBe(400);
    expect((await setRole(admin.authHeader, admin.user.id, "USER")).status).toBe(400);
    expect((await prisma.user.findUnique({ where: { id: admin.user.id } }))?.role).toBe("ADMIN");

    const second = await createTestAdmin();
    expect((await setRole(second.authHeader, admin.user.id, "EDITOR")).status).toBe(200);
  });

  it("each staff role reaches its legacy screens and nothing else", async () => {
    const roles = {
      EDITOR: await createTestUser({ role: "EDITOR" }),
      SUPPORT: await createTestUser({ role: "SUPPORT" }),
      MODERATOR: await createTestUser({ role: "MODERATOR" }),
      USER: await createTestUser(),
    };
    const expected: Record<string, Record<keyof typeof roles, number>> = {
      "/api/v1/newsletter": { EDITOR: 200, SUPPORT: 403, MODERATOR: 403, USER: 403 },
      "/api/v1/blogs/drafts": { EDITOR: 200, SUPPORT: 403, MODERATOR: 403, USER: 403 },
      "/api/v1/contacts": { EDITOR: 403, SUPPORT: 200, MODERATOR: 403, USER: 403 },
      "/api/v1/auth/users": { EDITOR: 403, SUPPORT: 403, MODERATOR: 403, USER: 403 },
    };
    for (const [path, byRole] of Object.entries(expected)) {
      for (const [role, status] of Object.entries(byRole)) {
        const res = await request(app).get(path).set(roles[role as keyof typeof roles].authHeader);
        expect({ path, role, status: res.status }).toEqual({ path, role, status });
      }
    }
  });

  it("staff without the admin role can't change roles", async () => {
    const support = await createTestUser({ role: "SUPPORT" });
    const member = await createTestUser();
    expect((await setRole(support.authHeader, member.user.id, "ADMIN")).status).toBe(403);
  });
});
