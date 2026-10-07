"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
require("dotenv/config");
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: zod_1.z.string().min(1, "DATABASE_URL is required"),
    PORT: zod_1.z.coerce.number().int().min(1).max(65535).default(5050),
    FRONTEND_URL: zod_1.z.string().default("http://localhost:3000"),
    CORS_ORIGINS: zod_1.z.string().default("http://localhost:3000,http://localhost:3001,http://localhost:5174,https://themora.vercel.app"),
    BCRYPT_ROUNDS: zod_1.z.coerce.number().int().min(4).max(31).default(12),
    SMTP_HOST: zod_1.z.string().default(""),
    SMTP_PORT: zod_1.z.string().default("587"),
    SMTP_USER: zod_1.z.string().default(""),
    SMTP_PASS: zod_1.z.string().default(""),
    EMAIL_FROM: zod_1.z.string().default(""),
    CONTACT_NOTIFICATION_EMAIL: zod_1.z.string().email().or(zod_1.z.literal("")).default(""),
    CLOUDINARY_CLOUD_NAME: zod_1.z.string().default(""),
    CLOUDINARY_API_KEY: zod_1.z.string().default(""),
    CLOUDINARY_API_SECRET: zod_1.z.string().default(""),
    CLOUDINARY_URL: zod_1.z.string().default(""),
    LEMONSQUEEZY_API_KEY: zod_1.z.string().default(""),
    LEMONSQUEEZY_STORE_ID: zod_1.z.string().default(""),
    LEMONSQUEEZY_WEBHOOK_SECRET: zod_1.z.string().default(""),
    VERCEL: zod_1.z.string().optional(),
});
exports.env = envSchema.parse({
    ...process.env,
    PORT: process.env.PORT ?? process.env.SERVER_RUNNING_PORT,
});
//# sourceMappingURL=env.js.map