import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { TEST_SCHEMA, assertTestDatabaseUrl, getTestDatabaseUrl } from "./helpers/testDatabaseUrl";

// Recreates the test schema from scratch and applies every migration, so the
// migration history itself is tested on each run.
export default async function setup() {
  const databaseUrl = getTestDatabaseUrl();
  assertTestDatabaseUrl(databaseUrl);

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${TEST_SCHEMA}"`);
  } finally {
    await prisma.$disconnect();
  }

  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
