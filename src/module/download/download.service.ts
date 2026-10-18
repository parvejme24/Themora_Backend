import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/AppError";
import { runInBackground } from "../../utils/background";
import { privateDownloadUrl } from "../../utils/cloudinary";
import { sendProductUpdateEmail } from "../../utils/email";
import { canDownloadProduct } from "../product/product-access";
import { findProductByIdOrSlug, productCardSelect } from "../product/product.service";
import { CreateVersionInput, UpdateVersionInput } from "./download.validation";
import { notificationService } from "../notification/notification.service";

const DAILY_DOWNLOAD_LIMIT = 50;
const LINK_TTL_SECONDS = 300;

interface DownloadUser {
  id: string;
  role: string;
}

const versionPublicSelect = {
  id: true,
  version: true,
  changelog: true,
  isLatest: true,
  releasedAt: true,
  _count: { select: { files: true } },
} satisfies Prisma.ProductVersionSelect;

// Legacy files are public URLs; new uploads are private Cloudinary assets
const fileLink = (file: { cloudinaryId: string | null; url: string | null }) => {
  if (file.cloudinaryId) return privateDownloadUrl(file.cloudinaryId, LINK_TTL_SECONDS);
  if (!file.url) throw AppError.notFound("This file is missing. Please contact support");
  const url = file.url.includes("res.cloudinary.com") && file.url.includes("/raw/upload/")
    ? file.url.replace("/upload/", "/upload/fl_attachment/")
    : file.url;
  return { url, expiresAt: null };
};

// Keeps the product's display version in sync with its latest release
const syncProductVersion = async (tx: Prisma.TransactionClient, productId: string) => {
  const latest = await tx.productVersion.findFirst({ where: { productId, isLatest: true }, select: { version: true } });
  const numeric = latest ? Number.parseFloat(latest.version) : NaN;
  if (Number.isFinite(numeric)) await tx.template.update({ where: { id: productId }, data: { version: numeric } });
};

export class DownloadService {
  // ── Public changelog ───────────────────────────────────────────────────

  async changelog(idOrSlug: string) {
    const product = await prisma.template.findFirst({
      where: { ...findProductByIdOrSlug(idOrSlug), status: "PUBLISHED" },
      select: { id: true },
    });
    if (!product) throw AppError.notFound("Product not found");
    const versions = await prisma.productVersion.findMany({
      where: { productId: product.id },
      orderBy: { releasedAt: "desc" },
      select: versionPublicSelect,
    });
    return versions.map(({ _count, ...version }) => ({ ...version, fileCount: _count.files }));
  }

  // ── Buyer downloads ────────────────────────────────────────────────────

  async listMine(user: DownloadUser) {
    const licenses = await prisma.license.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: "desc" },
      select: {
        licenseType: true,
        createdAt: true,
        template: {
          select: {
            ...productCardSelect,
            versions: { where: { isLatest: true }, select: { id: true, version: true, releasedAt: true } },
          },
        },
      },
    });
    const seen = new Set<string>();
    return licenses
      .filter((license) => !seen.has(license.template.id) && seen.add(license.template.id))
      .map(({ template: { versions, ...product }, licenseType, createdAt }) => ({
        product,
        licenseType,
        purchasedAt: createdAt,
        latestVersion: versions[0] ?? null,
      }));
  }

  async createLinks(user: DownloadUser, productId: string, options: { versionId?: string; fileId?: string; ip?: string }) {
    const product = await prisma.template.findUnique({
      where: { id: productId },
      select: { id: true, isFree: true, status: true, sourceFiles: true, version: true, updatedAt: true },
    });
    if (!product) throw AppError.notFound("Product not found");
    if (!(await canDownloadProduct(user, product))) throw AppError.forbidden("Purchase this product to download its files");

    if (user.role === "USER") {
      const recent = await prisma.downloadLog.count({
        where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      });
      if (recent >= DAILY_DOWNLOAD_LIMIT) {
        throw new AppError(429, "Daily download limit reached. Please try again tomorrow or contact support");
      }
    }

    const release = await prisma.productVersion.findFirst({
      where: { productId, ...(options.versionId ? { id: options.versionId } : { isLatest: true }) },
      include: { files: { orderBy: { sortOrder: "asc" } } },
    });
    // Products uploaded through the legacy admin form only have sourceFiles
    const version =
      release ??
      (!options.versionId && product.sourceFiles.length
        ? {
            id: null,
            version: String(product.version),
            releasedAt: product.updatedAt,
            files: product.sourceFiles.map((url, index) => ({
              id: `legacy-${index}`,
              name: url.replace(/^.*\//, ""),
              cloudinaryId: null,
              url,
              size: null,
            })),
          }
        : null);
    if (!version) throw AppError.notFound("No downloadable files have been released for this product yet");

    const files = options.fileId ? version.files.filter((file) => file.id === options.fileId) : version.files;
    if (files.length === 0) throw AppError.notFound("File not found");

    const links = files.map((file) => ({ id: file.id, name: file.name, size: file.size, ...fileLink(file) }));

    await prisma.$transaction([
      prisma.downloadLog.create({
        data: { userId: user.id, productId, versionId: version.id, fileId: options.fileId ?? null, ip: options.ip ?? null },
      }),
      prisma.template.update({ where: { id: productId }, data: { downloads: { increment: 1 } } }),
    ]);

    return { version: version.version, releasedAt: version.releasedAt, files: links };
  }

  // ── Admin: versions ────────────────────────────────────────────────────

  async listVersions(productId: string) {
    return prisma.productVersion.findMany({
      where: { productId },
      orderBy: { releasedAt: "desc" },
      include: { files: { orderBy: { sortOrder: "asc" } }, _count: { select: { downloads: true } } },
    });
  }

  async createVersion(productId: string, input: CreateVersionInput) {
    const product = await prisma.template.findUnique({ where: { id: productId }, select: { id: true, title: true, slug: true } });
    if (!product) throw AppError.notFound("Product not found");
    const exists = await prisma.productVersion.findUnique({ where: { productId_version: { productId, version: input.version } } });
    if (exists) throw AppError.conflict(`Version ${input.version} already exists`);

    const version = await prisma.$transaction(async (tx) => {
      if (input.makeLatest) await tx.productVersion.updateMany({ where: { productId }, data: { isLatest: false } });
      const created = await tx.productVersion.create({
        data: {
          productId,
          version: input.version,
          changelog: input.changelog,
          isLatest: input.makeLatest,
          files: { create: input.files.map((file, index) => ({ ...file, sortOrder: index })) },
        },
        include: { files: true },
      });
      if (input.makeLatest) await syncProductVersion(tx, productId);
      return created;
    });

    if (input.makeLatest && input.notifyBuyers) {
      runInBackground("notify buyers of new version", () => this.notifyBuyers(product, version.version, version.changelog));
    }
    return version;
  }

  async updateVersion(versionId: string, input: UpdateVersionInput) {
    const version = await prisma.productVersion.findUnique({ where: { id: versionId }, select: { id: true, productId: true } });
    if (!version) throw AppError.notFound("Version not found");
    return prisma.$transaction(async (tx) => {
      if (input.isLatest) await tx.productVersion.updateMany({ where: { productId: version.productId }, data: { isLatest: false } });
      const updated = await tx.productVersion.update({ where: { id: versionId }, data: input, include: { files: true } });
      if (input.isLatest) await syncProductVersion(tx, version.productId);
      return updated;
    });
  }

  // Deleting the latest version promotes the newest remaining one
  async deleteVersion(versionId: string) {
    const version = await prisma.productVersion.findUnique({ where: { id: versionId }, select: { id: true, productId: true, isLatest: true } });
    if (!version) throw AppError.notFound("Version not found");
    await prisma.$transaction(async (tx) => {
      await tx.productVersion.delete({ where: { id: versionId } });
      if (!version.isLatest) return;
      const next = await tx.productVersion.findFirst({ where: { productId: version.productId }, orderBy: { releasedAt: "desc" } });
      if (next) {
        await tx.productVersion.update({ where: { id: next.id }, data: { isLatest: true } });
        await syncProductVersion(tx, version.productId);
      }
    });
  }

  private async notifyBuyers(product: { id: string; title: string; slug: string }, version: string, changelog: string) {
    const licenses = await prisma.license.findMany({
      where: { templateId: product.id, isActive: true, user: { isNot: null } },
      select: { user: { select: { id: true, email: true, fullName: true } } },
    });
    await notificationService.notifyMany(
      licenses.flatMap((license) => (license.user ? [license.user.id] : [])),
      { type: "product_update", title: `${product.title} ${version} is available`, link: "/dashboard/downloads" }
    );
    const recipients = new Map(licenses.flatMap((license) => (license.user ? [[license.user.email, license.user.fullName]] : [])));
    for (const [email, name] of recipients) {
      await sendProductUpdateEmail(email, name, product, version, changelog).catch((error) =>
        console.error(`Update email to ${email} failed:`, error)
      );
    }
  }
}

export const downloadService = new DownloadService();
