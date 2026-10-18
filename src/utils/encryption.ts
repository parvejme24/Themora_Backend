import crypto from "node:crypto";
import { env } from "../config/env";
import { AppError } from "./AppError";

// AES-256-GCM for secrets that must be read back (e.g. TOTP secrets).
// Format: iv.authTag.ciphertext (base64url)
const key = () => {
  if (!env.ENCRYPTION_KEY) throw new AppError(503, "Encryption is not configured (ENCRYPTION_KEY)");
  return crypto.createHash("sha256").update(env.ENCRYPTION_KEY).digest();
};

export const encrypt = (plain: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64url")).join(".");
};

export const decrypt = (payload: string) => {
  const [iv, tag, data] = payload.split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
};
