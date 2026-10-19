import { OrderStatus, PaymentProvider, Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/AppError";
import { buildPaginationMeta } from "../../utils/pagination";
import { refundService } from "../refund/refund.service";
import { myOrderInclude, toMyOrder } from "./my-orders.service";

export interface AdminOrderQuery {
  q?: string;
  status?: OrderStatus;
  provider?: PaymentProvider;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

const listSelect = {
  id: true,
  orderNumber: true,
  status: true,
  totalAmount: true,
  currency: true,
  provider: true,
  couponCode: true,
  customerName: true,
  customerEmail: true,
  createdAt: true,
  paidAt: true,
  user: { select: { id: true, fullName: true } },
  template: { select: { title: true } },
  pricingPlan: { select: { title: true } },
  items: { select: { title: true }, orderBy: { createdAt: "asc" } },
  refundRequests: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
} satisfies Prisma.OrderInvoiceSelect;

const detailInclude = {
  ...myOrderInclude,
  refundRequests: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      reason: true,
      adminNote: true,
      amount: true,
      providerRefundId: true,
      failureReason: true,
      createdAt: true,
      resolvedAt: true,
      resolvedBy: { select: { id: true, fullName: true } },
    },
  },
  licenses: {
    select: {
      id: true,
      licenseKey: true,
      licenseType: true,
      isActive: true,
      templateId: true,
      _count: { select: { activations: true } },
    },
  },
  user: { select: { id: true, fullName: true, email: true, role: true } },
  affiliate: { select: { id: true, code: true } },
  tickets: { select: { id: true, subject: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" } },
} satisfies Prisma.OrderInvoiceInclude;

const buildWhere = (query: AdminOrderQuery): Prisma.OrderInvoiceWhereInput => {
  const and: Prisma.OrderInvoiceWhereInput[] = [];
  if (query.status) and.push({ status: query.status });
  if (query.provider) and.push({ provider: query.provider });
  if (query.from || query.to) and.push({ createdAt: { gte: query.from, lte: query.to } });
  if (query.q) {
    const term = query.q;
    and.push({
      OR: [
        { orderNumber: { contains: term, mode: "insensitive" } },
        { customerEmail: { contains: term, mode: "insensitive" } },
        { customerName: { contains: term, mode: "insensitive" } },
        { couponCode: { equals: term, mode: "insensitive" } },
        { providerPaymentId: term },
      ],
    });
  }
  return and.length ? { AND: and } : {};
};

export const adminOrdersService = {
  async list(query: AdminOrderQuery) {
    const where = buildWhere(query);
    const [orders, total, byStatus] = await Promise.all([
      prisma.orderInvoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: listSelect,
      }),
      prisma.orderInvoice.count({ where }),
      // Tab counts ignore the status filter so every tab shows its own number
      prisma.orderInvoice.groupBy({ by: ["status"], where: buildWhere({ ...query, status: undefined }), _count: { _all: true } }),
    ]);

    const rows = orders.map(({ items, template, pricingPlan, refundRequests, ...order }) => {
      // Legacy single-product orders have no items
      const titles = items.length ? items.map((item) => item.title) : [template?.title ?? pricingPlan?.title ?? "Order"];
      return { ...order, itemCount: titles.length, firstItem: titles[0], refundStatus: refundRequests[0]?.status ?? null };
    });
    const counts = Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])) as Partial<Record<OrderStatus, number>>;
    return { orders: rows, counts, pagination: buildPaginationMeta(total, query.page, query.limit) };
  },

  async get(id: string) {
    const order = await prisma.orderInvoice.findUnique({ where: { id }, include: detailInclude });
    if (!order) throw AppError.notFound("Order not found");
    return {
      ...toMyOrder(order),
      refundRequests: order.refundRequests,
      licenses: order.licenses,
      user: order.user,
      affiliate: order.affiliate,
      tickets: order.tickets,
      providerPaymentId: order.providerPaymentId,
      providerSessionId: order.providerSessionId,
      failureReason: order.failureReason,
      updatedAt: order.updatedAt,
    };
  },

  /**
   * Refund started by staff (e.g. the buyer asked by email). Records a refund
   * request on the buyer's behalf and approves it, so the money goes back
   * through the gateway and licences are revoked exactly as for buyer requests.
   * Staff may refund outside the buyer's refund window.
   */
  async refund(id: string, staffId: string, reason: string) {
    const order = await prisma.orderInvoice.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true, totalAmount: true, provider: true },
    });
    if (!order) throw AppError.notFound("Order not found");
    if (order.status !== "COMPLETED") throw AppError.badRequest("Only completed orders can be refunded");
    if (order.totalAmount <= 0 || order.provider === "FREE") throw AppError.badRequest("Free orders cannot be refunded");
    if (!order.userId) {
      throw AppError.badRequest("This is a guest order. It links to an account once the buyer signs in with the order email");
    }

    const open = await prisma.refundRequest.findFirst({
      where: { orderId: id, status: { in: ["REQUESTED", "FAILED"] } },
      select: { id: true },
    });
    const request =
      open ??
      (await prisma.refundRequest.create({
        data: { orderId: id, userId: order.userId, reason: `Refunded by staff: ${reason}`, amount: order.totalAmount },
        select: { id: true },
      }));
    return refundService.approve(request.id, staffId, reason);
  },
};
