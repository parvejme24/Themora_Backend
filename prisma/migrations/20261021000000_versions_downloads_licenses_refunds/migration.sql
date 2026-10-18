-- CreateEnum
CREATE TYPE "RefundRequestStatus" AS ENUM ('REQUESTED', 'REFUNDED', 'REJECTED', 'FAILED');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "upgradesLicenseId" TEXT;

-- CreateTable
CREATE TABLE "product_versions" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "changelog" TEXT NOT NULL DEFAULT '',
    "isLatest" BOOLEAN NOT NULL DEFAULT false,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_files" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cloudinaryId" TEXT,
    "url" TEXT,
    "size" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "download_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "versionId" TEXT,
    "fileId" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "download_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_activations" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_activations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_requests" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "adminNote" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "providerRefundId" TEXT,
    "failureReason" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_versions_productId_isLatest_idx" ON "product_versions"("productId", "isLatest");

-- CreateIndex
CREATE UNIQUE INDEX "product_versions_productId_version_key" ON "product_versions"("productId", "version");

-- CreateIndex
CREATE INDEX "product_files_versionId_idx" ON "product_files"("versionId");

-- CreateIndex
CREATE INDEX "download_logs_userId_createdAt_idx" ON "download_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "download_logs_productId_idx" ON "download_logs"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "license_activations_licenseId_domain_key" ON "license_activations"("licenseId", "domain");

-- CreateIndex
CREATE INDEX "refund_requests_status_idx" ON "refund_requests"("status");

-- CreateIndex
CREATE INDEX "refund_requests_orderId_idx" ON "refund_requests"("orderId");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_upgradesLicenseId_fkey" FOREIGN KEY ("upgradesLicenseId") REFERENCES "licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_versions" ADD CONSTRAINT "product_versions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_files" ADD CONSTRAINT "product_files_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "product_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_logs" ADD CONSTRAINT "download_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_logs" ADD CONSTRAINT "download_logs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_logs" ADD CONSTRAINT "download_logs_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "product_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_activations" ADD CONSTRAINT "license_activations_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: existing source files become each product's initial (latest) version
INSERT INTO "product_versions" ("id", "productId", "version", "changelog", "isLatest", "releasedAt", "createdAt")
SELECT gen_random_uuid()::text, t."id", to_char(t."version", 'FM999990.0###'), 'Initial release', true,
       COALESCE(t."publishedAt", t."createdAt"), CURRENT_TIMESTAMP
FROM "templates" t
WHERE cardinality(t."sourceFiles") > 0;

INSERT INTO "product_files" ("id", "versionId", "name", "url", "sortOrder")
SELECT gen_random_uuid()::text, v."id", regexp_replace(f.url, '^.*/', ''), f.url, (f.ord - 1)::int
FROM "product_versions" v
JOIN "templates" t ON t."id" = v."productId",
     unnest(t."sourceFiles") WITH ORDINALITY AS f(url, ord);
