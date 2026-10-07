import { prisma } from "../../config/database";
import { CreateOrderInput, UpdateOrderStatusInput, Order, PaginatedOrders, OrderStats, OrderQuery } from "./order.type";

export class OrderService {
  async getAllOrders(query: OrderQuery): Promise<PaginatedOrders> {
    const { page, limit, status, userId, templateId, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (userId) {
      where.userId = userId;
    }
    
    if (templateId) {
      where.templateId = templateId;
    }

    // Build orderBy clause
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [orders, total] = await Promise.all([
      prisma.orderInvoice.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          template: {
            select: {
              id: true,
              title: true,
              price: true,
              imageUrl: true,
              shortDescription: true,
            },
          },
          pricingPlan: {
            select: { id: true, title: true, price: true, websiteLimit: true },
          },
          planEntitlement: {
            select: { isActive: true, websitesAllowed: true, supportExpiresAt: true },
          },
          licenses: {
            select: {
              id: true,
              licenseKey: true,
              licenseType: true,
              isActive: true,
              expiresAt: true,
            },
          },
        },
      }),
      prisma.orderInvoice.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      orders: orders as Order[],
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getOrderById(id: string): Promise<Order | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const order = await prisma.orderInvoice.findFirst({
      where: isUuid ? { OR: [{ id }, { lemonsqueezyOrderId: id }] } : { lemonsqueezyOrderId: id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        template: {
          select: {
            id: true,
            title: true,
            price: true,
            imageUrl: true,
            shortDescription: true,
          },
        },
        pricingPlan: {
          select: { id: true, title: true, price: true, websiteLimit: true },
        },
        planEntitlement: {
          select: { isActive: true, websitesAllowed: true, supportExpiresAt: true },
        },
        licenses: {
          select: {
            id: true,
            licenseKey: true,
            licenseType: true,
            isActive: true,
            expiresAt: true,
          },
        },
      },
    });

    return order as Order | null;
  }

  async createOrder(data: CreateOrderInput): Promise<Order> {
    const order = await prisma.orderInvoice.create({
      data: {
        ...data,
        downloadLinks: data.downloadLinks || [],
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        template: {
          select: {
            id: true,
            title: true,
            price: true,
            imageUrl: true,
            shortDescription: true,
          },
        },
        pricingPlan: {
          select: { id: true, title: true, price: true, websiteLimit: true },
        },
        planEntitlement: {
          select: { isActive: true, websitesAllowed: true, supportExpiresAt: true },
        },
        licenses: {
          select: {
            id: true,
            licenseKey: true,
            licenseType: true,
            isActive: true,
            expiresAt: true,
          },
        },
      },
    });

    return order as Order;
  }

  async updateOrderStatus(id: string, data: UpdateOrderStatusInput): Promise<Order | null> {
    const order = await prisma.orderInvoice.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        template: {
          select: {
            id: true,
            title: true,
            price: true,
            imageUrl: true,
            shortDescription: true,
          },
        },
        pricingPlan: {
          select: { id: true, title: true, price: true, websiteLimit: true },
        },
        planEntitlement: {
          select: { isActive: true, websitesAllowed: true, supportExpiresAt: true },
        },
        licenses: {
          select: {
            id: true,
            licenseKey: true,
            licenseType: true,
            isActive: true,
            expiresAt: true,
          },
        },
      },
    });

    return order as Order;
  }

  async getOrderStats(): Promise<OrderStats> {
    const [
      totalOrders,
      totalRevenue,
      ordersByStatus,
      ordersByLicenseType,
    ] = await Promise.all([
      prisma.orderInvoice.count(),
      prisma.orderInvoice.aggregate({
        _sum: { totalAmount: true },
      }),
      prisma.orderInvoice.groupBy({
        by: ['status'],
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
      prisma.orderInvoice.groupBy({
        by: ['licenseType'],
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
    ]);

    const ordersByStatusFormatted = ordersByStatus.map((item) => ({
      status: item.status,
      count: item._count.id,
      revenue: item._sum.totalAmount || 0,
    }));

    const ordersByLicenseTypeFormatted = ordersByLicenseType.map((item) => ({
      licenseType: item.licenseType,
      count: item._count.id,
      revenue: item._sum.totalAmount || 0,
    }));

    return {
      totalOrders,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      ordersByStatus: ordersByStatusFormatted,
      ordersByLicenseType: ordersByLicenseTypeFormatted,
    };
  }

  async claimGuestOrders(userId: string, email: string): Promise<void> {
    const guestOrders = await prisma.orderInvoice.findMany({
      where: { userId: null, customerEmail: { equals: email.trim(), mode: "insensitive" } },
      select: { id: true },
    });
    const orderIds = guestOrders.map((order) => order.id);
    if (orderIds.length === 0) return;

    await prisma.$transaction([
      prisma.orderInvoice.updateMany({ where: { id: { in: orderIds }, userId: null }, data: { userId } }),
      prisma.license.updateMany({ where: { orderId: { in: orderIds }, userId: null }, data: { userId } }),
      prisma.planEntitlement.updateMany({ where: { orderId: { in: orderIds }, userId: null }, data: { userId } }),
    ]);
  }

  async getUserOrders(userId: string, email: string, query: Omit<OrderQuery, 'userId'>): Promise<PaginatedOrders> {
    await this.claimGuestOrders(userId, email);
    return this.getAllOrders({ ...query, userId });
  }

  async getTopSellingTemplates(limit: number = 5) {
    const orders = await prisma.orderInvoice.groupBy({
      by: ['templateId'],
      where: {
        templateId: { not: null },
        status: { in: ['COMPLETED', 'PROCESSING'] },
      },
      _count: { id: true },
      _sum: { totalAmount: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    const templateIds = orders.map((o) => o.templateId).filter(Boolean) as string[];
    const templates = await prisma.template.findMany({
      where: { id: { in: templateIds } },
      include: { category: { select: { title: true } } },
    });

    const templateMap = new Map(templates.map((t) => [t.id, t]));

    const result = orders
      .map((order) => {
        const template = templateMap.get(order.templateId!);
        if (!template) return null;
        return {
          template: {
            id: template.id,
            title: template.title,
            price: template.price,
            imageUrl: template.imageUrl,
            shortDescription: template.shortDescription,
            categoryName: template.category?.title || template.categoryName || undefined,
          },
          totalOrders: order._count.id,
          totalRevenue: order._sum.totalAmount || 0,
        };
      })
      .filter(Boolean);

    // If fewer than limit orders, fill with top templates from DB
    if (result.length < limit) {
      const existingIds = new Set(result.map((r: any) => r.template.id));
      const additionalTemplates = await prisma.template.findMany({
        where: { id: { notIn: Array.from(existingIds) } },
        take: limit - result.length,
        orderBy: { downloads: 'desc' },
        include: { category: { select: { title: true } } },
      });

      for (const t of additionalTemplates) {
        result.push({
          template: {
            id: t.id,
            title: t.title,
            price: t.price,
            imageUrl: t.imageUrl,
            shortDescription: t.shortDescription,
            categoryName: t.category?.title || t.categoryName || undefined,
          },
          totalOrders: t.totalPurchase || 0,
          totalRevenue: (t.totalPurchase || 0) * t.price,
        });
      }
    }

    return result;
  }
}

export const orderService = new OrderService();

