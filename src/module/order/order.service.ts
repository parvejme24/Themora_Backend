import { PrismaClient } from "@prisma/client";
import { CreateOrderInput, UpdateOrderStatusInput, Order, PaginatedOrders, OrderStats, OrderQuery } from "./order.type";

const prisma = new PrismaClient();

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
    const order = await prisma.orderInvoice.findUnique({
      where: { id },
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
}

