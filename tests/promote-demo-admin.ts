import "dotenv/config";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required to promote the demo account");
if (process.env.NODE_ENV === "production") throw new Error("Demo account promotion is disabled in production");

const databaseHost = new URL(databaseUrl).hostname;
const isLocalDatabase = ["localhost", "127.0.0.1", "::1"].includes(databaseHost);
if (!isLocalDatabase && process.env.ALLOW_REMOTE_ADMIN_SEED !== "true") {
  throw new Error("Remote admin promotion requires ALLOW_REMOTE_ADMIN_SEED=true");
}

const email = "demo@themora.test";
const password = crypto.randomBytes(24).toString("base64url");
const prisma = new PrismaClient();

async function promoteDemoAdmin() {
  const hashedPassword = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    create: {
      fullName: "Themora Demo Admin",
      email,
      password: hashedPassword,
      role: "ADMIN",
      provider: "email",
      otpVerified: true,
    },
    update: {
      fullName: "Themora Demo Admin",
      password: hashedPassword,
      role: "ADMIN",
      provider: "email",
      otpVerified: true,
      otpCode: null,
      otpPurpose: null,
      otpExpiresAt: null,
      nextAuthSecret: null,
      nextAuthExpiresAt: null,
      isLoggedIn: false,
      lastLoginAt: null,
      isBanned: false,
      isTrashed: false,
      isDeletedPermanently: false,
    },
  });

  console.log(`${isLocalDatabase ? "Local" : "Remote"} demo admin is ready.`);
  console.log(`Email: ${email}`);
  console.log(`New password: ${password}`);
  console.log("Store this password securely; it cannot be recovered by email for the .test address.");
}

promoteDemoAdmin()
  .catch((error) => {
    console.error("Failed to promote demo account:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
