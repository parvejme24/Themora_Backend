"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderService = void 0;
const database_1 = require("../../config/database");
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
            database_1.prisma.orderInvoice.findMany({
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
            database_1.prisma.orderInvoice.count({ where }),
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
        const order = await database_1.prisma.orderInvoice.findUnique({
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
        const order = await database_1.prisma.orderInvoice.create({
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
        const order = await database_1.prisma.orderInvoice.update({
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
            database_1.prisma.orderInvoice.count(),
            database_1.prisma.orderInvoice.aggregate({
                _sum: { totalAmount: true },
            }),
            database_1.prisma.orderInvoice.groupBy({
                by: ['status'],
                _count: { id: true },
                _sum: { totalAmount: true },
            }),
            database_1.prisma.orderInvoice.groupBy({
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
        const guestOrders = await database_1.prisma.orderInvoice.findMany({
            where: { userId: null, customerEmail: { equals: email.trim(), mode: "insensitive" } },
            select: { id: true },
        });
        const orderIds = guestOrders.map((order) => order.id);
        if (orderIds.length === 0)
            return;
        await database_1.prisma.$transaction([
            database_1.prisma.orderInvoice.updateMany({ where: { id: { in: orderIds }, userId: null }, data: { userId } }),
            database_1.prisma.license.updateMany({ where: { orderId: { in: orderIds }, userId: null }, data: { userId } }),
            database_1.prisma.planEntitlement.updateMany({ where: { orderId: { in: orderIds }, userId: null }, data: { userId } }),
        ]);
    }
    async getUserOrders(userId, email, query) {
        await this.claimGuestOrders(userId, email);
        return this.getAllOrders({ ...query, userId });
    }
    async getTopSellingTemplates(limit = 5) {
        const orders = await database_1.prisma.orderInvoice.groupBy({
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
        const templateIds = orders.map((o) => o.templateId).filter(Boolean);
        const templates = await database_1.prisma.template.findMany({
            where: { id: { in: templateIds } },
            include: { category: { select: { title: true } } },
        });
        const templateMap = new Map(templates.map((t) => [t.id, t]));
        const result = orders
            .map((order) => {
            const template = templateMap.get(order.templateId);
            if (!template)
                return null;
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
        if (result.length < limit) {
            const existingIds = new Set(result.map((r) => r.template.id));
            const additionalTemplates = await database_1.prisma.template.findMany({
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
exports.OrderService = OrderService;
//# sourceMappingURL=order.service.js.map