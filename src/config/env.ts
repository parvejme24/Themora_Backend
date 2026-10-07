import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5050),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3001,http://localhost:5174,https://themora.vercel.app"),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(31).default(12),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.string().default("587"),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  EMAIL_FROM: z.string().default(""),
  CONTACT_NOTIFICATION_EMAIL: z.string().email().or(z.literal("")).default(""),
  CLOUDINARY_CLOUD_NAME: z.string().default(""),
  CLOUDINARY_API_KEY: z.string().default(""),
  CLOUDINARY_API_SECRET: z.string().default(""),
  CLOUDINARY_URL: z.string().default(""),
  LEMONSQUEEZY_API_KEY: z.string().default(""),
  LEMONSQUEEZY_STORE_ID: z.string().default(""),
  LEMONSQUEEZY_WEBHOOK_SECRET: z.string().default(""),
  VERCEL: z.string().optional(),
});

export const env = envSchema.parse({
  ...process.env,
  PORT: process.env.PORT ?? process.env.SERVER_RUNNING_PORT,
});
