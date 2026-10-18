import { Coupon, Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/AppError";
import { buildPaginationMeta } from "../../utils/pagination";
import { CouponInput, CouponQuery } from "./coupon.validation";

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export interface DiscountableItem {
  productId?: string;
  categoryId?: string | null;
  unitPrice: number;
}

export interface CouponContext {
  userId?: string | null;
  email: string;
}

export interface CouponResult {
  coupon: Coupon;
  discountTotal: number;
  // Discount per item, same order as the input items
  itemDiscounts: number[];
}

export const normalizeCode = (code: string) => code.trim().toUpperCase();

const isEligible = (coupon: Coupon, item: DiscountableItem) => {
  if (!item.productId) return false; // coupons apply to products, not plans
  if (coupon.productIds.length === 0 && coupon.categoryIds.length === 0) return true;
  return coupon.productIds.includes(item.productId) || (!!item.categoryId && coupon.categoryIds.includes(item.categoryId));
};

// Splits a discount across items in proportion to their price; the last
// eligible item absorbs rounding so the parts add up exactly
const allocate = (discount: number, items: DiscountableItem[], eligible: boolean[]) => {
  const eligibleTotal = items.reduce((sum, item, i) => sum + (eligible[i] ? item.unitPrice : 0), 0);
  const lastIndex = eligible.lastIndexOf(true);
  let allocated = 0;
  return items.map((item, i) => {
    if (!eligible[i] || eligibleTotal === 0) return 0;
    if (i === lastIndex) return roundMoney(discount - allocated);
    const share = roundMoney((discount * item.unitPrice) / eligibleTotal);
    allocated = roundMoney(allocated + share);
    return share;
  });
};

export class CouponService {
  async evaluate(code: string, items: DiscountableItem[], context: CouponContext): Promise<CouponResult> {
    const coupon = await prisma.coupon.findUnique({ where: { code: normalizeCode(code) } });
    const now = new Date();
    if (!coupon || !coupon.isActive) throw AppError.badRequest("This coupon code is not valid");
    if (coupon.startsAt && coupon.startsAt > now) throw AppError.badRequest("This coupon is not active yet");
    if (coupon.endsAt && coupon.endsAt < now) throw AppError.badRequest("This coupon has expired");
    if (coupon.maxUses !== null && coupon.usesCount >= coupon.maxUses) {
      throw AppError.badRequest("This coupon has reached its usage limit");
    }

    const customerFilter: Prisma.CouponRedemptionWhereInput = context.userId
      ? { OR: [{ userId: context.userId }, { email: context.email }] }
      : { email: context.email };

    if (coupon.perUserLimit !== null) {
      const used = await prisma.couponRedemption.count({ where: { couponId: coupon.id, ...customerFilter } });
      if (used >= coupon.perUserLimit) throw AppError.badRequest("You have already used this coupon");
    }

    if (coupon.firstOrderOnly) {
      const previousOrders = await prisma.orderInvoice.count({
        where: {
          status: "COMPLETED",
          totalAmount: { gt: 0 },
          OR: [...(context.userId ? [{ userId: context.userId }] : []), { customerEmail: context.email }],
        },
      });
      if (previousOrders > 0) throw AppError.badRequest("This coupon is only valid on your first order");
    }

    const eligible = items.map((item) => isEligible(coupon, item));
    const eligibleSubtotal = roundMoney(items.reduce((sum, item, i) => sum + (eligible[i] ? item.unitPrice : 0), 0));
    if (eligibleSubtotal === 0) throw AppError.badRequest("This coupon does not apply to the items in your cart");
    if (coupon.minSubtotal !== null && eligibleSubtotal < coupon.minSubtotal) {
      throw AppError.badRequest(`Spend at least $${coupon.minSubtotal.toFixed(2)} on eligible items to use this coupon`);
    }

    let discount = coupon.type === "PERCENT" ? (eligibleSubtotal * coupon.value) / 100 : coupon.value;
    if (coupon.maxDiscount !== null) discount = Math.min(discount, coupon.maxDiscount);
    discount = roundMoney(Math.min(discount, eligibleSubtotal));

    return { coupon, discountTotal: discount, itemDiscounts: allocate(discount, items, eligible) };
  }

  // Called once per paid order (inside the fulfilment transaction)
  async redeem(tx: Prisma.TransactionClient, order: { id: string; couponId: string | null; userId: string | null; customerEmail: string; discountTotal: number }) {
    if (!order.couponId) return;
    await tx.couponRedemption.create({
      data: { couponId: order.couponId, orderId: order.id, userId: order.userId, email: order.customerEmail, discount: order.discountTotal },
    });
    await tx.coupon.update({ where: { id: order.couponId }, data: { usesCount: { increment: 1 } } });
  }

  // ── Admin ──────────────────────────────────────────────────────────────

  async list(query: CouponQuery) {
    const where: Prisma.CouponWhereInput = {
      ...(query.q ? { code: { contains: query.q.toUpperCase() } } : {}),
      ...(query.active !== undefined ? { isActive: query.active } : {}),
    };
    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { _count: { select: { redemptions: true } } },
      }),
      prisma.coupon.count({ where }),
    ]);
    return { coupons, pagination: buildPaginationMeta(total, query.page, query.limit) };
  }

  async get(id: string) {
    const coupon = await prisma.coupon.findUnique({
      where: { id },
      include: {
        redemptions: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { order: { select: { id: true, orderNumber: true, totalAmount: true } } },
        },
      },
    });
    if (!coupon) throw AppError.notFound("Coupon not found");
    const revenue = await prisma.orderInvoice.aggregate({ where: { couponId: id, status: "COMPLETED" }, _sum: { totalAmount: true, discountTotal: true } });
    return { ...coupon, stats: { revenue: revenue._sum.totalAmount ?? 0, discountGiven: revenue._sum.discountTotal ?? 0 } };
  }

  create(input: CouponInput) {
    return prisma.coupon.create({ data: { ...input, code: normalizeCode(input.code) } });
  }

  async update(id: string, input: Partial<CouponInput>) {
    await this.get(id);
    return prisma.coupon.update({ where: { id }, data: { ...input, ...(input.code ? { code: normalizeCode(input.code) } : {}) } });
  }

  // Used coupons are deactivated, unused ones deleted
  async remove(id: string) {
    const coupon = await prisma.coupon.findUnique({ where: { id }, select: { usesCount: true } });
    if (!coupon) throw AppError.notFound("Coupon not found");
    if (coupon.usesCount > 0) {
      await prisma.coupon.update({ where: { id }, data: { isActive: false } });
      return { deactivated: true };
    }
    await prisma.coupon.delete({ where: { id } });
    return { deactivated: false };
  }
}

export const couponService = new CouponService();
