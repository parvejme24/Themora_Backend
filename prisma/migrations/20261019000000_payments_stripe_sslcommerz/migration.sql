-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'SSLCOMMERZ', 'FREE', 'MANUAL');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'FAILED';

-- DropIndex
DROP INDEX "licenses_lemonsqueezyOrderId_idx";

-- DropIndex
DROP INDEX "order_invoices_lemonsqueezyOrderId_idx";

-- DropIndex
DROP INDEX "order_invoices_lemonsqueezyOrderId_key";

-- DropIndex
DROP INDEX "pricing_plans_lemonsqueezyVariantId_key";

-- AlterTable
ALTER TABLE "licenses" DROP COLUMN "lemonsqueezyOrderId",
ADD COLUMN     "orderItemId" TEXT;

-- AlterTable
-- Keep existing order numbers: rename instead of drop + add
ALTER TABLE "order_invoices" RENAME COLUMN "lemonsqueezyOrderId" TO "orderNumber";

-- AlterTable
ALTER TABLE "order_invoices" DROP COLUMN "lemonsqueezyInvoiceId",
ADD COLUMN     "chargeAmount" DOUBLE PRECISION,
ADD COLUMN     "chargeCurrency" TEXT,
ADD COLUMN     "discountTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "provider" "PaymentProvider",
ADD COLUMN     "providerPaymentId" TEXT,
ADD COLUMN     "providerSessionId" TEXT,
ADD COLUMN     "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "pricing_plans" DROP COLUMN "lemonsqueezyVariantId";

-- AlterTable
ALTER TABLE "templates" DROP COLUMN "checkoutUrl",
DROP COLUMN "lemonsqueezyPermalink",
DROP COLUMN "lemonsqueezyProductId",
DROP COLUMN "lemonsqueezyVariantId";

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "pricingPlanId" TEXT,
    "title" TEXT NOT NULL,
    "licenseType" "LicenseType" NOT NULL DEFAULT 'SINGLE',
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "order_items_productId_idx" ON "order_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_eventId_key" ON "webhook_events"("provider", "eventId");

-- CreateIndex
CREATE INDEX "licenses_orderItemId_idx" ON "licenses"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "order_invoices_orderNumber_key" ON "order_invoices"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "order_invoices_providerSessionId_key" ON "order_invoices"("providerSessionId");

-- CreateIndex
CREATE INDEX "order_invoices_providerPaymentId_idx" ON "order_invoices"("providerPaymentId");

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_pricingPlanId_fkey" FOREIGN KEY ("pricingPlanId") REFERENCES "pricing_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: existing orders become single-item orders
UPDATE "order_invoices" SET "subtotal" = "totalAmount";
UPDATE "order_invoices" SET "paidAt" = "createdAt" WHERE "status" = 'COMPLETED';

INSERT INTO "order_items" ("id", "orderId", "productId", "pricingPlanId", "title", "licenseType", "unitPrice", "total", "createdAt")
SELECT gen_random_uuid()::text, o."id", o."templateId", o."pricingPlanId",
       COALESCE(t."title", p."title", 'Legacy order'), o."licenseType", o."totalAmount", o."totalAmount", o."createdAt"
FROM "order_invoices" o
LEFT JOIN "templates" t ON t."id" = o."templateId"
LEFT JOIN "pricing_plans" p ON p."id" = o."pricingPlanId";

UPDATE "licenses" l SET "orderItemId" = i."id"
FROM "order_items" i
WHERE i."orderId" = l."orderId" AND i."productId" = l."templateId";
