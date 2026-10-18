-- AlterTable
ALTER TABLE "carts" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "otpAttempts" INTEGER NOT NULL DEFAULT 0;


-- Session tokens and pending OTPs are now stored as SHA-256 hashes.
-- Hash existing values in place so nobody is logged out.
UPDATE "users" SET "nextAuthSecret" = encode(sha256(convert_to("nextAuthSecret", 'UTF8')), 'hex') WHERE "nextAuthSecret" IS NOT NULL;
UPDATE "users" SET "otpCode" = encode(sha256(convert_to("id" || ':' || "otpCode", 'UTF8')), 'hex') WHERE "otpCode" IS NOT NULL;
