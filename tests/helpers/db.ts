import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { prisma } from "../../src/config/database";
import { TEST_SCHEMA, assertTestDatabaseUrl } from "./testDatabaseUrl";
import { hashToken } from "../../src/utils/secureToken";

// Empties every table in the test schema. Call in beforeEach/beforeAll.
export const resetDatabase = async () => {
  assertTestDatabaseUrl(process.env.DATABASE_URL);
  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = '${TEST_SCHEMA}' AND tablename <> '_prisma_migrations'`
  );
  if (tables.length === 0) return;
  const list = tables.map(({ tablename }) => `"${TEST_SCHEMA}"."${tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
};

interface TestUserOptions {
  role?: UserRole;
  email?: string;
  fullName?: string;
  password?: string;
  isBanned?: boolean;
}

// Creates a user with an active session. Send `token` as `Authorization: Bearer <token>`.
export const createTestUser = async (options: TestUserOptions = {}) => {
  const token = crypto.randomBytes(24).toString("hex");
  const user = await prisma.user.create({
    data: {
      fullName: options.fullName ?? "Test User",
      email: options.email ?? `user-${crypto.randomUUID()}@themora.test`,
      password: await bcrypt.hash(options.password ?? "Password!2026", 4),
      role: options.role ?? "USER",
      isBanned: options.isBanned ?? false,
      otpVerified: true,
      isLoggedIn: true,
      nextAuthSecret: hashToken(token),
      nextAuthExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      provider: "email",
    },
  });
  return { user, token, authHeader: { Authorization: `Bearer ${token}` } };
};

export const createTestAdmin = (options: Omit<TestUserOptions, "role"> = {}) =>
  createTestUser({ ...options, role: "ADMIN", fullName: options.fullName ?? "Test Admin" });

export { prisma };
