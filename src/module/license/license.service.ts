import { prisma } from "../../config/database";
import { AppError } from "../../utils/AppError";
import { activeSalePrice } from "../../utils/pricing";

const roundMoney = (value: number) => Math.round(value * 100) / 100;

// "https://www.Example.com/shop" → "example.com"; localhost stays as is
export const normalizeDomain = (input: string) => {
  const host = input.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").split(/[/?#]/)[0].split(":")[0];
  return host.replace(/^www\./, "");
};

const findByKey = async (licenseKey: string) => {
  const license = await prisma.license.findUnique({
    where: { licenseKey: licenseKey.trim().toUpperCase() },
    include: {
      template: { select: { title: true, slug: true } },
      activations: { orderBy: { createdAt: "asc" }, select: { id: true, domain: true, createdAt: true } },
    },
  });
  if (!license) throw AppError.notFound("Licence key not found");
  return license;
};

export class LicenseService {
  async listMine(userId: string) {
    const licenses = await prisma.license.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        template: {
          select: { id: true, slug: true, title: true, imageUrl: true, price: true, salePrice: true, saleEndsAt: true, extendedPrice: true, status: true },
        },
        order: { select: { id: true, orderNumber: true, createdAt: true } },
        orderItem: { select: { total: true } },
        activations: { orderBy: { createdAt: "asc" }, select: { id: true, domain: true, createdAt: true } },
      },
    });

    return licenses.map(({ template, orderItem, ...license }) => {
      const canUpgrade =
        license.isActive && license.licenseType === "SINGLE" && template.extendedPrice != null && template.status === "PUBLISHED";
      const paid = orderItem?.total ?? activeSalePrice(template) ?? template.price;
      return {
        ...license,
        product: { id: template.id, slug: template.slug, title: template.title, imageUrl: template.imageUrl },
        activationsUsed: license.activations.length,
        canUpgrade,
        upgradePrice: canUpgrade ? roundMoney(Math.max(template.extendedPrice! - paid, 0)) : null,
      };
    });
  }

  // Public check for buyers' apps and themes; reveals no customer details
  async verify(licenseKey: string, domain?: string) {
    const license = await prisma.license.findUnique({
      where: { licenseKey: licenseKey.trim().toUpperCase() },
      include: { template: { select: { title: true, slug: true } }, activations: { select: { domain: true } } },
    });
    if (!license) return { valid: false, reason: "not_found" as const };

    const expired = license.expiresAt !== null && license.expiresAt < new Date();
    const normalized = domain ? normalizeDomain(domain) : undefined;
    return {
      valid: license.isActive && !expired,
      reason: !license.isActive ? ("revoked" as const) : expired ? ("expired" as const) : null,
      licenseType: license.licenseType,
      product: license.template,
      activationsUsed: license.activations.length,
      activationLimit: license.activationLimit,
      ...(normalized ? { activatedOnDomain: license.activations.some((a) => a.domain === normalized) } : {}),
    };
  }

  async activate(licenseKey: string, domain: string) {
    const license = await findByKey(licenseKey);
    if (!license.isActive) throw AppError.forbidden("This licence has been revoked");
    if (license.expiresAt && license.expiresAt < new Date()) throw AppError.forbidden("This licence has expired");

    const normalized = normalizeDomain(domain);
    if (!normalized) throw AppError.badRequest("Enter a valid domain");
    if (license.activations.some((activation) => activation.domain === normalized)) {
      return { activated: true, domain: normalized, alreadyActive: true };
    }
    if (license.activationLimit !== null && license.activations.length >= license.activationLimit) {
      throw AppError.conflict(
        `This ${license.licenseType.toLowerCase()} licence is already active on ${license.activations.map((a) => a.domain).join(", ")}. ` +
          "Deactivate it there first or upgrade to an extended licence"
      );
    }

    await prisma.licenseActivation.create({ data: { licenseId: license.id, domain: normalized } });
    await prisma.license.update({ where: { id: license.id }, data: { usedCount: { increment: 1 } } });
    return { activated: true, domain: normalized, alreadyActive: false };
  }

  async deactivate(licenseKey: string, domain: string) {
    const license = await findByKey(licenseKey);
    const result = await prisma.licenseActivation.deleteMany({ where: { licenseId: license.id, domain: normalizeDomain(domain) } });
    return { deactivated: result.count > 0 };
  }

  async removeActivation(userId: string, licenseId: string, activationId: string) {
    const result = await prisma.licenseActivation.deleteMany({
      where: { id: activationId, licenseId, license: { userId } },
    });
    if (result.count === 0) throw AppError.notFound("Activation not found");
  }
}

export const licenseService = new LicenseService();
