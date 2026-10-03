"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const bcrypt_1 = __importDefault(require("bcrypt"));
const client_1 = require("@prisma/client");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
    throw new Error("DATABASE_URL is required to seed the demo user");
if (process.env.NODE_ENV === "production")
    throw new Error("Demo accounts cannot be seeded in production");
const databaseHost = new URL(databaseUrl).hostname;
const isLocalDatabase = ["localhost", "127.0.0.1", "::1"].includes(databaseHost);
if (!isLocalDatabase && process.env.ALLOW_REMOTE_DEMO_SEED !== "true") {
    throw new Error("Remote demo account seeding requires ALLOW_REMOTE_DEMO_SEED=true");
}
const email = (process.env.DEMO_USER_EMAIL || "demo@themora.test").trim().toLowerCase();
const password = process.env.DEMO_USER_PASSWORD || "ThemoraDemo!2026";
if (password.length < 12)
    throw new Error("DEMO_USER_PASSWORD must be at least 12 characters");
const prisma = new client_1.PrismaClient();
async function seedDemoUser() {
    const hashedPassword = await bcrypt_1.default.hash(password, 12);
    await prisma.user.upsert({
        where: { email },
        create: {
            fullName: "Themora Demo User",
            email,
            password: hashedPassword,
            role: "USER",
            provider: "email",
            otpVerified: true,
            isBanned: false,
            isTrashed: false,
            isDeletedPermanently: false,
        },
        update: {
            fullName: "Themora Demo User",
            password: hashedPassword,
            role: "USER",
            provider: "email",
            otpVerified: true,
            isBanned: false,
            isTrashed: false,
            isDeletedPermanently: false,
        },
    });
    console.log(`${isLocalDatabase ? "Local" : "Remote"} demo user is ready.`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
}
seedDemoUser()
    .catch((error) => {
    console.error("Failed to seed demo user:", error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-demo.js.map