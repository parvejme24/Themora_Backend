import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { buildPaginationMeta } from "../../utils/pagination";
import { orderService } from "./order.service";

interface Buyer {
  id: string;
  email: string;
}

const productSelect = { id: true, slug: true, title: true, imageUrl: true } as const;

const myOrderInclude = {
  items: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      licenseType: true,
      unitPrice: true,
      discount: true,
      total: true,
      product: { select: productSelect },
      pricingPlan: { select: { id: true, slug: true, title: true, billingInterval: true } },
    },
  },
  // Legacy single-product orders have no items, only the template
  template: { select: productSelect },
  pricingPlan: { select: { id: true, slug: true, title: true, billingInterval: true } },
  licenses: { select: { id: true, licenseKey: true, licenseType: true, isActive: true, templateId: true } },
  refundRequests: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { id: true, status: true, reason: true, adminNote: true, createdAt: true, resolvedAt: true },
  },
} satisfies Prisma.OrderInvoiceInclude;

type MyOrderRow = Prisma.OrderInvoiceGetPayload<{ include: typeof myOrderInclude }>;

const ownedBy = (buyer: Buyer): Prisma.OrderInvoiceWhereInput => ({
  OR: [{ userId: buyer.id }, { userId: null, customerEmail: { equals: buyer.email, mode: "insensitive" } }],
});

// Shape for the buyer dashboard: line items, refund window and the latest refund request
const toMyOrder = (order: MyOrderRow) => {
  const paidAt = order.paidAt ?? (order.status === "COMPLETED" ? order.createdAt : null);
  const refundableUntil = paidAt ? new Date(paidAt.getTime() + env.REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000) : null;
  const latestRefund = order.refundRequests[0] ?? null;
  const items =
    order.items.length > 0
      ? order.items
      : [
          {
            id: order.id,
            title: order.template?.title ?? order.pricingPlan?.title ?? "Order",
            licenseType: order.licenseType ?? "SINGLE",
            unitPrice: order.subtotal || order.totalAmount,
            discount: order.discountTotal,
            total: order.totalAmount,
            product: order.template,
            pricingPlan: order.pricingPlan,
          },
        ];

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    subtotal: order.subtotal || order.totalAmount,
    discountTotal: order.discountTotal,
    totalAmount: order.totalAmount,
    currency: order.currency,
    chargeAmount: order.chargeAmount,
    chargeCurrency: order.chargeCurrency,
    couponCode: order.couponCode,
    provider: order.provider,
    paymentMethod: order.paymentMethod,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    billingAddress: order.billingAddress,
    paidAt,
    createdAt: order.createdAt,
    items,
    licenses: order.licenses,
    refundableUntil,
    canRequestRefund:
      order.status === "COMPLETED" &&
      order.totalAmount > 0 &&
      order.provider !== "FREE" &&
      !!refundableUntil &&
      refundableUntil > new Date() &&
      latestRefund?.status !== "REQUESTED",
    refundRequest: latestRefund,
  };
};

export const myOrdersService = {
  async list(buyer: Buyer, query: { page: number; limit: number; status?: string }) {
    // Orders placed as a guest with this email become the buyer's
    await orderService.claimGuestOrders(buyer.id, buyer.email);
    const where: Prisma.OrderInvoiceWhereInput = {
      ...ownedBy(buyer),
      ...(query.status ? { status: query.status as Prisma.EnumOrderStatusFilter["equals"] } : {}),
    };
    const [orders, total] = await Promise.all([
      prisma.orderInvoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: myOrderInclude,
      }),
      prisma.orderInvoice.count({ where }),
    ]);
    return { orders: orders.map(toMyOrder), pagination: buildPaginationMeta(total, query.page, query.limit) };
  },

  async get(buyer: Buyer, id: string) {
    const order = await prisma.orderInvoice.findFirst({ where: { id, ...ownedBy(buyer) }, include: myOrderInclude });
    if (!order) throw AppError.notFound("Order not found");
    return toMyOrder(order);
  },
};
