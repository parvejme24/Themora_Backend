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
  // Comma-separated Google OAuth client IDs accepted as ID token audiences
  GOOGLE_CLIENT_ID: z.string().default(""),
  // Public URL of this API, used for SSLCommerz callbacks
  BACKEND_URL: z.string().default("http://localhost:5050"),
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  SSLCOMMERZ_STORE_ID: z.string().default(""),
  SSLCOMMERZ_STORE_PASSWORD: z.string().default(""),
  SSLCOMMERZ_SANDBOX: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
  // SSLCommerz charges in BDT; catalogue prices are USD
  USD_TO_BDT_RATE: z.coerce.number().positive().default(122),
  // Buyers can request a refund this many days after paying
  REFUND_WINDOW_DAYS: z.coerce.number().int().min(0).default(14),
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>"
  CRON_SECRET: z.string().default(""),
  SENTRY_DSN: z.string().default(""),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  VERCEL: z.string().optional(),
});

export const env = envSchema.parse({
  ...process.env,
  PORT: process.env.PORT ?? process.env.SERVER_RUNNING_PORT,
  // Accept the misspelled CLAUDINARY_* keys some .env files use
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ?? process.env.CLAUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ?? process.env.CLAUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ?? process.env.CLAUDINARY_API_SECRET,
});
