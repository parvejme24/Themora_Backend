import crypto from "node:crypto";
import { AffiliateStatus, PayoutStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { buildPaginationMeta } from "../../utils/pagination";

const DAY = 24 * 60 * 60 * 1000;
const roundMoney = (value: number) => Math.round(value * 100) / 100;

export const normalizeAffiliateCode = (code: string) => code.trim().toUpperCase();

const generateCode = (name: string) => {
  const base = name.normalize("NFKD").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 8) || "THEMORA";
  return `${base}${crypto.randomInt(10, 99)}`;
};

// Click visitors are stored as a daily-salted hash, never as raw IP addresses
const visitorHash = (ip: string, userAgent: string) =>
  crypto.createHash("sha256").update(`${new Date().toISOString().slice(0, 10)}:${ip}:${userAgent}`).digest("hex");

interface ApplyInput {
  code?: string;
  payoutMethod: string;
  payoutDetails: string;
  website?: string;
}

export class AffiliateService {
  // ── Affiliate (self) ───────────────────────────────────────────────────

  async apply(user: { id: string; fullName: string }, input: ApplyInput) {
    const existing = await prisma.affiliate.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (existing) throw AppError.conflict("You have already joined the affiliate program");

    let code = input.code ? normalizeAffiliateCode(input.code) : generateCode(user.fullName);
    if (input.code) {
      if (await prisma.affiliate.findUnique({ where: { code }, select: { id: true } })) throw AppError.conflict("This referral code is taken");
    } else {
      while (await prisma.affiliate.findUnique({ where: { code }, select: { id: true } })) code = generateCode(user.fullName);
    }

    const autoApprove = env.AFFILIATE_AUTO_APPROVE;
    return prisma.affiliate.create({
      data: {
        userId: user.id,
        code,
        commissionRate: env.AFFILIATE_COMMISSION_RATE,
        payoutMethod: input.payoutMethod,
        payoutDetails: input.payoutDetails,
        website: input.website ?? null,
        status: autoApprove ? "ACTIVE" : "PENDING",
        approvedAt: autoApprove ? new Date() : null,
      },
    });
  }

  async updateMine(userId: string, input: Partial<Pick<ApplyInput, "payoutMethod" | "payoutDetails" | "website">>) {
    await this.findMine(userId);
    return prisma.affiliate.update({ where: { userId }, data: input });
  }

  private async findMine(userId: string) {
    const affiliate = await prisma.affiliate.findUnique({ where: { userId } });
    if (!affiliate) throw AppError.notFound("You have not joined the affiliate program yet");
    return affiliate;
  }

  private async balances(affiliateId: string) {
    const [byStatus, clicks, inOpenPayout] = await Promise.all([
      prisma.referral.groupBy({ by: ["status"], where: { affiliateId }, _sum: { commission: true }, _count: { _all: true } }),
      prisma.affiliateClick.count({ where: { affiliateId } }),
      prisma.referral.aggregate({ where: { affiliateId, status: "APPROVED", payoutId: { not: null } }, _sum: { commission: true } }),
    ]);
    const sum = (status: string) => roundMoney(byStatus.find((row) => row.status === status)?._sum.commission ?? 0);
    const count = (status: string) => byStatus.find((row) => row.status === status)?._count._all ?? 0;
    const conversions = count("PENDING") + count("APPROVED") + count("PAID");
    const approved = sum("APPROVED");
    const requested = roundMoney(inOpenPayout._sum.commission ?? 0);
    return {
      clicks,
      conversions,
      conversionRate: clicks ? Math.round((conversions / clicks) * 1000) / 10 : 0,
      pending: sum("PENDING"),
      available: roundMoney(approved - requested),
      requested,
      paid: sum("PAID"),
      lifetime: roundMoney(sum("PENDING") + approved + sum("PAID")),
      minimumPayout: env.AFFILIATE_MIN_PAYOUT,
    };
  }

  async dashboard(userId: string) {
    const affiliate = await this.findMine(userId);
    return { ...affiliate, stats: await this.balances(affiliate.id) };
  }

  async referrals(userId: string, page: number, limit: number) {
    const affiliate = await this.findMine(userId);
    const where = { affiliateId: affiliate.id };
    const [referrals, total] = await Promise.all([
      prisma.referral.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        // Affiliates see what was bought, never who bought it
        select: {
          id: true,
          orderAmount: true,
          commission: true,
          status: true,
          approvableAt: true,
          createdAt: true,
          order: { select: { orderNumber: true, items: { select: { title: true } } } },
        },
      }),
      prisma.referral.count({ where }),
    ]);
    return { referrals, pagination: buildPaginationMeta(total, page, limit) };
  }

  async payouts(userId: string) {
    const affiliate = await this.findMine(userId);
    return prisma.affiliatePayout.findMany({ where: { affiliateId: affiliate.id }, orderBy: { createdAt: "desc" } });
  }

  // Bundles every approved, unrequested commission into one payout request
  async requestPayout(userId: string) {
    const affiliate = await this.findMine(userId);
    if (affiliate.status !== "ACTIVE") throw AppError.forbidden("Your affiliate account is not active");
    const open = await prisma.affiliatePayout.findFirst({ where: { affiliateId: affiliate.id, status: "REQUESTED" }, select: { id: true } });
    if (open) throw AppError.conflict("You already have a payout request being processed");

    return prisma.$transaction(async (tx) => {
      const ready = await tx.referral.findMany({
        where: { affiliateId: affiliate.id, status: "APPROVED", payoutId: null },
        select: { id: true, commission: true },
      });
      const amount = roundMoney(ready.reduce((sum, referral) => sum + referral.commission, 0));
      if (amount < env.AFFILIATE_MIN_PAYOUT) {
        throw AppError.badRequest(`You need at least $${env.AFFILIATE_MIN_PAYOUT.toFixed(2)} in approved commission to request a payout`);
      }
      const payout = await tx.affiliatePayout.create({
        data: { affiliateId: affiliate.id, amount, method: affiliate.payoutMethod, details: affiliate.payoutDetails },
      });
      await tx.referral.updateMany({ where: { id: { in: ready.map((referral) => referral.id) } }, data: { payoutId: payout.id } });
      return payout;
    });
  }

  // ── Tracking & attribution ─────────────────────────────────────────────

  async recordClick(code: string, meta: { ip: string; userAgent: string; landingPath?: string; referrer?: string }) {
    const affiliate = await prisma.affiliate.findUnique({ where: { code: normalizeAffiliateCode(code) }, select: { id: true, status: true } });
    if (!affiliate || affiliate.status !== "ACTIVE") return { valid: false };

    // One click per visitor per affiliate per day
    const hash = visitorHash(meta.ip, meta.userAgent);
    const seen = await prisma.affiliateClick.findFirst({
      where: { affiliateId: affiliate.id, visitorHash: hash, createdAt: { gt: new Date(Date.now() - DAY) } },
      select: { id: true },
    });
    if (!seen) {
      await prisma.affiliateClick.create({
        data: { affiliateId: affiliate.id, visitorHash: hash, landingPath: meta.landingPath?.slice(0, 300), referrer: meta.referrer?.slice(0, 300) },
      });
    }
    return { valid: true };
  }

  // The affiliate to credit for an order, or null (unknown, inactive or self-referral)
  async resolveForCheckout(code: string | undefined, buyer: { userId?: string | null; email: string }) {
    if (!code) return null;
    const affiliate = await prisma.affiliate.findUnique({
      where: { code: normalizeAffiliateCode(code) },
      select: { id: true, status: true, userId: true, user: { select: { email: true } } },
    });
    if (!affiliate || affiliate.status !== "ACTIVE") return null;
    if (affiliate.userId === buyer.userId || affiliate.user.email.toLowerCase() === buyer.email.toLowerCase()) return null;
    return affiliate.id;
  }

  // Inside the fulfilment transaction: commission on the amount actually paid
  async createReferral(tx: Prisma.TransactionClient, order: { id: string; affiliateId: string | null; totalAmount: number }) {
    if (!order.affiliateId || order.totalAmount <= 0) return;
    const affiliate = await tx.affiliate.findUnique({ where: { id: order.affiliateId }, select: { commissionRate: true, status: true } });
    if (!affiliate || affiliate.status !== "ACTIVE") return;
    await tx.referral.create({
      data: {
        affiliateId: order.affiliateId,
        orderId: order.id,
        orderAmount: order.totalAmount,
        commission: roundMoney(order.totalAmount * affiliate.commissionRate),
        // Held until buyers can no longer ask for a refund
        approvableAt: new Date(Date.now() + env.REFUND_WINDOW_DAYS * DAY),
      },
    });
  }

  async reverseForOrder(orderId: string) {
    await prisma.referral.updateMany({
      where: { orderId, status: { in: ["PENDING", "APPROVED"] } },
      data: { status: "REVERSED", payoutId: null },
    });
  }

  // Daily cron: commissions past the refund window become payable
  async approveMatured(now = new Date()) {
    const result = await prisma.referral.updateMany({
      where: { status: "PENDING", approvableAt: { lt: now }, order: { status: "COMPLETED" } },
      data: { status: "APPROVED" },
    });
    return { approved: result.count };
  }

  // ── Admin ──────────────────────────────────────────────────────────────

  async adminList(query: { status?: AffiliateStatus; page: number; limit: number }) {
    const where: Prisma.AffiliateWhereInput = query.status ? { status: query.status } : {};
    const [affiliates, total] = await Promise.all([
      prisma.affiliate.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { user: { select: { id: true, fullName: true, email: true } } },
      }),
      prisma.affiliate.count({ where }),
    ]);
    const withStats = await Promise.all(affiliates.map(async (affiliate) => ({ ...affiliate, stats: await this.balances(affiliate.id) })));
    return { affiliates: withStats, pagination: buildPaginationMeta(total, query.page, query.limit) };
  }

  async adminUpdate(id: string, input: { status?: AffiliateStatus; commissionRate?: number }) {
    const affiliate = await prisma.affiliate.findUnique({ where: { id }, select: { approvedAt: true } });
    if (!affiliate) throw AppError.notFound("Affiliate not found");
    return prisma.affiliate.update({
      where: { id },
      data: { ...input, ...(input.status === "ACTIVE" && !affiliate.approvedAt ? { approvedAt: new Date() } : {}) },
    });
  }

  async adminPayouts(query: { status?: PayoutStatus; page: number; limit: number }) {
    const where: Prisma.AffiliatePayoutWhereInput = query.status ? { status: query.status } : {};
    const [payouts, total] = await Promise.all([
      prisma.affiliatePayout.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { affiliate: { select: { id: true, code: true, user: { select: { fullName: true, email: true } } } }, _count: { select: { referrals: true } } },
      }),
      prisma.affiliatePayout.count({ where }),
    ]);
    return { payouts, pagination: buildPaginationMeta(total, query.page, query.limit) };
  }

  // The admin sends the money manually (bKash, bank, PayPal) and records the reference
  async markPayoutPaid(id: string, reference: string) {
    const payout = await this.findOpenPayout(id);
    return prisma.$transaction(async (tx) => {
      await tx.referral.updateMany({ where: { payoutId: payout.id, status: "APPROVED" }, data: { status: "PAID" } });
      return tx.affiliatePayout.update({ where: { id }, data: { status: "PAID", reference, paidAt: new Date() } });
    });
  }

  // Commissions go back to the affiliate's available balance
  async rejectPayout(id: string, note: string) {
    const payout = await this.findOpenPayout(id);
    return prisma.$transaction(async (tx) => {
      await tx.referral.updateMany({ where: { payoutId: payout.id }, data: { payoutId: null } });
      return tx.affiliatePayout.update({ where: { id }, data: { status: "REJECTED", note } });
    });
  }

  private async findOpenPayout(id: string) {
    const payout = await prisma.affiliatePayout.findUnique({ where: { id } });
    if (!payout) throw AppError.notFound("Payout not found");
    if (payout.status !== "REQUESTED") throw AppError.conflict("This payout has already been processed");
    return payout;
  }
}

export const affiliateService = new AffiliateService();
