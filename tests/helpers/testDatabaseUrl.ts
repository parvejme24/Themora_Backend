import "dotenv/config";

// CI uses its own schema per run (TEST_SCHEMA=themora_ci_<run id>)
export const TEST_SCHEMA = process.env.TEST_SCHEMA || "themora_test";
if (!/^themora_[a-z0-9_]+$/.test(TEST_SCHEMA)) {
  throw new Error(`TEST_SCHEMA must look like "themora_<name>", got "${TEST_SCHEMA}"`);
}

// Tests run on the same Neon database as development, isolated in their own
// Postgres schema so the `public` schema (live data) is never touched.
// TEST_DATABASE_URL can point somewhere else entirely if needed.
export const getTestDatabaseUrl = (): string => {
  const base = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL (or TEST_DATABASE_URL) is required to run tests");

  const url = new URL(base);
  url.searchParams.set("schema", TEST_SCHEMA);
  return url.toString();
};

export const assertTestDatabaseUrl = (databaseUrl: string | undefined) => {
  const schema = databaseUrl ? new URL(databaseUrl).searchParams.get("schema") : null;
  if (schema !== TEST_SCHEMA) {
    throw new Error(`Refusing to run: tests must use the "${TEST_SCHEMA}" schema, got "${schema ?? "public"}"`);
  }
};
