import { env } from "./env";

export const DATABASE_URL = env.DATABASE_URL;
export const BCRYPT_ROUNDS = env.BCRYPT_ROUNDS;
export const FRONTEND_URL = env.FRONTEND_URL;
export const PORT = env.PORT;

export const SMTP_HOST = env.SMTP_HOST;
export const SMTP_PORT = env.SMTP_PORT;
export const SMTP_USER = env.SMTP_USER;
export const SMTP_PASS = env.SMTP_PASS;
export const EMAIL_FROM = env.EMAIL_FROM;
export const CONTACT_NOTIFICATION_EMAIL = env.CONTACT_NOTIFICATION_EMAIL;

export const CLOUDINARY_CLOUD_NAME = env.CLOUDINARY_CLOUD_NAME;
export const CLOUDINARY_API_KEY = env.CLOUDINARY_API_KEY;
export const CLOUDINARY_API_SECRET = env.CLOUDINARY_API_SECRET;
export const CLOUDINARY_URL = env.CLOUDINARY_URL;
