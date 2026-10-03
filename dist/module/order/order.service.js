"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderService = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class OrderService {
    async getAllOrders(query) {
        const { page, limit, status, userId, templateId, sortBy, sortOrder } = query;
        const skip = (page - 1) * limit;
        const where = {};
        if (status) {
            where.status = status;
        }
        if (userId) {
            where.userId = userId;
        }
        if (templateId) {
            where.templateId = templateId;
        }
        const orderBy = {};
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
            orders: orders,
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
    async getOrderById(id) {
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
        return order;
    }
    async createOrder(data) {
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
        return order;
    }
    async updateOrderStatus(id, data) {
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
        return order;
    }
    async getOrderStats() {
        const [totalOrders, totalRevenue, ordersByStatus, ordersByLicenseType,] = await Promise.all([
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
    async claimGuestOrders(userId, email) {
        const guestOrders = await prisma.orderInvoice.findMany({
            where: { userId: null, customerEmail: { equals: email.trim(), mode: "insensitive" } },
            select: { id: true },
        });
        const orderIds = guestOrders.map((order) => order.id);
        if (orderIds.length === 0)
            return;
        await prisma.$transaction([
            prisma.orderInvoice.updateMany({ where: { id: { in: orderIds }, userId: null }, data: { userId } }),
            prisma.license.updateMany({ where: { orderId: { in: orderIds }, userId: null }, data: { userId } }),
            prisma.planEntitlement.updateMany({ where: { orderId: { in: orderIds }, userId: null }, data: { userId } }),
        ]);
    }
    async getUserOrders(userId, email, query) {
        await this.claimGuestOrders(userId, email);
        return this.getAllOrders({ ...query, userId });
    }
}
exports.OrderService = OrderService;
//# sourceMappingURL=order.service.js.map