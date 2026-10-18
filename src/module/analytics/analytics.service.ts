import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/AppError";
import { productCardSelect } from "../product/product.service";

const DAY = 24 * 60 * 60 * 1000;
const roundMoney = (value: number) => Math.round(value * 100) / 100;

// Stats are bucketed by UTC day
export const utcDay = (date = new Date()) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const dayKey = (date: Date) => date.toISOString().slice(0, 10);

const emptySeries = (days: number) => {
  const today = utcDay();
  return Array.from({ length: days }, (_, i) => dayKey(new Date(today.getTime() - (days - 1 - i) * DAY)));
};

type Db = Prisma.TransactionClient | typeof prisma;

export class AnalyticsService {
  async recordView(productId: string) {
    const date = utcDay();
    await prisma.productDailyStat.upsert({
      where: { productId_date: { productId, date } },
      create: { productId, date, views: 1 },
      update: { views: { increment: 1 } },
    });
  }

  // Called inside the fulfilment transaction for each product sold
  async recordSale(db: Db, productId: string, revenue: number) {
    const date = utcDay();
    await db.productDailyStat.upsert({
      where: { productId_date: { productId, date } },
      create: { productId, date, sales: 1, revenue },
      update: { sales: { increment: 1 }, revenue: { increment: revenue } },
    });
  }

  async overview(days: number) {
    const since = new Date(utcDay().getTime() - (days - 1) * DAY);
    const previousSince = new Date(since.getTime() - days * DAY);

    const [orders, previous, refunds, newCustomers, productStats, providers, affiliates, coupons, subscriptions] = await Promise.all([
      prisma.orderInvoice.findMany({
        where: { status: "COMPLETED", paidAt: { gte: since }, totalAmount: { gt: 0 } },
        select: { paidAt: true, totalAmount: true },
      }),
      prisma.orderInvoice.aggregate({
        where: { status: "COMPLETED", paidAt: { gte: previousSince, lt: since }, totalAmount: { gt: 0 } },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      prisma.orderInvoice.aggregate({ where: { status: "REFUNDED", updatedAt: { gte: since } }, _sum: { totalAmount: true }, _count: { _all: true } }),
      prisma.user.count({ where: { createdAt: { gte: since }, role: "USER" } }),
      prisma.productDailyStat.groupBy({
        by: ["productId"],
        where: { date: { gte: since } },
        _sum: { views: true, sales: true, revenue: true },
      }),
      prisma.orderInvoice.groupBy({
        by: ["provider"],
        where: { status: "COMPLETED", paidAt: { gte: since }, totalAmount: { gt: 0 } },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      prisma.referral.groupBy({
        by: ["affiliateId"],
        where: { createdAt: { gte: since }, status: { not: "REVERSED" } },
        _sum: { orderAmount: true, commission: true },
        _count: { _all: true },
        orderBy: { _sum: { orderAmount: "desc" } },
        take: 5,
      }),
      prisma.orderInvoice.groupBy({
        by: ["couponCode"],
        where: { status: "COMPLETED", paidAt: { gte: since }, couponCode: { not: null } },
        _sum: { discountTotal: true, totalAmount: true },
        _count: { _all: true },
        orderBy: { _count: { couponCode: "desc" } },
        take: 5,
      }),
      prisma.subscription.findMany({
        where: { status: { in: ["ACTIVE", "PAST_DUE"] }, currentPeriodEnd: { gt: new Date() } },
        select: { pricingPlan: { select: { price: true, billingInterval: true } } },
      }),
    ]);

    // Daily revenue and order series with empty days filled in
    const byDay = new Map(emptySeries(days).map((day) => [day, { date: day, revenue: 0, orders: 0 }]));
    for (const order of orders) {
      const bucket = byDay.get(dayKey(order.paidAt!));
      if (bucket) {
        bucket.revenue = roundMoney(bucket.revenue + order.totalAmount);
        bucket.orders += 1;
      }
    }

    const revenue = roundMoney(orders.reduce((sum, order) => sum + order.totalAmount, 0));
    const previousRevenue = previous._sum.totalAmount ?? 0;
    const views = productStats.reduce((sum, row) => sum + (row._sum.views ?? 0), 0);
    const sales = productStats.reduce((sum, row) => sum + (row._sum.sales ?? 0), 0);

    const topRows = [...productStats].sort((a, b) => (b._sum.revenue ?? 0) - (a._sum.revenue ?? 0)).slice(0, 10);
    const [topProducts, affiliateRows] = await Promise.all([
      prisma.template.findMany({ where: { id: { in: topRows.map((row) => row.productId) } }, select: { id: true, slug: true, title: true, imageUrl: true } }),
      prisma.affiliate.findMany({
        where: { id: { in: affiliates.map((row) => row.affiliateId) } },
        select: { id: true, code: true, user: { select: { fullName: true } } },
      }),
    ]);
    const productById = new Map(topProducts.map((product) => [product.id, product]));
    const affiliateById = new Map(affiliateRows.map((affiliate) => [affiliate.id, affiliate]));

    // Monthly recurring revenue from all-access subscriptions
    const mrr = roundMoney(
      subscriptions.reduce((sum, sub) => sum + (sub.pricingPlan.billingInterval === "YEAR" ? sub.pricingPlan.price / 12 : sub.pricingPlan.price), 0)
    );

    return {
      range: { days, since },
      totals: {
        revenue,
        orders: orders.length,
        averageOrderValue: orders.length ? roundMoney(revenue / orders.length) : 0,
        revenueChange: previousRevenue ? Math.round(((revenue - previousRevenue) / previousRevenue) * 1000) / 10 : null,
        refunds: { count: refunds._count._all, amount: roundMoney(refunds._sum.totalAmount ?? 0) },
        newCustomers,
        productViews: views,
        conversionRate: views ? Math.round((sales / views) * 10000) / 100 : 0,
        activeSubscribers: subscriptions.length,
        mrr,
      },
      daily: [...byDay.values()],
      topProducts: topRows.map((row) => ({
        product: productById.get(row.productId) ?? null,
        views: row._sum.views ?? 0,
        sales: row._sum.sales ?? 0,
        revenue: roundMoney(row._sum.revenue ?? 0),
        conversionRate: row._sum.views ? Math.round(((row._sum.sales ?? 0) / row._sum.views) * 10000) / 100 : 0,
      })),
      paymentProviders: providers.map((row) => ({ provider: row.provider, orders: row._count._all, revenue: roundMoney(row._sum.totalAmount ?? 0) })),
      topAffiliates: affiliates.map((row) => ({
        code: affiliateById.get(row.affiliateId)?.code,
        name: affiliateById.get(row.affiliateId)?.user.fullName,
        orders: row._count._all,
        revenue: roundMoney(row._sum.orderAmount ?? 0),
        commission: roundMoney(row._sum.commission ?? 0),
      })),
      topCoupons: coupons.map((row) => ({
        code: row.couponCode,
        orders: row._count._all,
        discount: roundMoney(row._sum.discountTotal ?? 0),
        revenue: roundMoney(row._sum.totalAmount ?? 0),
      })),
    };
  }

  async product(productId: string, days: number) {
    const product = await prisma.template.findUnique({ where: { id: productId }, select: { id: true, slug: true, title: true } });
    if (!product) throw AppError.notFound("Product not found");
    const since = new Date(utcDay().getTime() - (days - 1) * DAY);
    const rows = await prisma.productDailyStat.findMany({ where: { productId, date: { gte: since } } });

    const byDay = new Map(emptySeries(days).map((day) => [day, { date: day, views: 0, sales: 0, revenue: 0 }]));
    for (const row of rows) {
      const bucket = byDay.get(dayKey(row.date));
      if (bucket) Object.assign(bucket, { views: row.views, sales: row.sales, revenue: roundMoney(row.revenue) });
    }
    const daily = [...byDay.values()];
    const views = daily.reduce((sum, day) => sum + day.views, 0);
    const sales = daily.reduce((sum, day) => sum + day.sales, 0);
    return {
      product,
      totals: {
        views,
        sales,
        revenue: roundMoney(daily.reduce((sum, day) => sum + day.revenue, 0)),
        conversionRate: views ? Math.round((sales / views) * 10000) / 100 : 0,
      },
      daily,
    };
  }

  // ── Personalisation ────────────────────────────────────────────────────

  async rememberView(userId: string, productId: string) {
    await prisma.recentlyViewed.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: { viewedAt: new Date() },
    });
  }

  async recentlyViewed(userId: string, limit = 12) {
    const rows = await prisma.recentlyViewed.findMany({
      where: { userId, product: { status: "PUBLISHED" } },
      orderBy: { viewedAt: "desc" },
      take: limit,
      select: { viewedAt: true, product: { select: productCardSelect } },
    });
    return rows.map((row) => ({ ...row.product, viewedAt: row.viewedAt }));
  }

  // Products most often bought in the same orders, or by the same customers
  async alsoBought(productId: string, limit = 8) {
    const buyers = await prisma.orderInvoice.findMany({
      where: { status: "COMPLETED", OR: [{ templateId: productId }, { items: { some: { productId } } }] },
      orderBy: { paidAt: "desc" },
      take: 500,
      select: { userId: true, customerEmail: true },
    });
    if (buyers.length === 0) return [];

    const userIds = [...new Set(buyers.flatMap((buyer) => (buyer.userId ? [buyer.userId] : [])))];
    const emails = [...new Set(buyers.map((buyer) => buyer.customerEmail))];
    const items = await prisma.orderItem.findMany({
      where: {
        productId: { not: null, notIn: [productId] },
        order: { status: "COMPLETED", OR: [{ userId: { in: userIds } }, { customerEmail: { in: emails } }] },
      },
      select: { productId: true },
      take: 5000,
    });

    const counts = new Map<string, number>();
    for (const item of items) counts.set(item.productId!, (counts.get(item.productId!) ?? 0) + 1);
    const ranked = [...counts].sort((a, b) => b[1] - a[1]).slice(0, limit * 2).map(([id]) => id);

    const products = await prisma.template.findMany({ where: { id: { in: ranked }, status: "PUBLISHED" }, select: productCardSelect });
    const order = new Map(ranked.map((id, index) => [id, index]));
    return products.sort((a, b) => order.get(a.id)! - order.get(b.id)!).slice(0, limit);
  }
}

export const analyticsService = new AnalyticsService();
