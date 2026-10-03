"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsletterService = void 0;
const database_1 = require("../../config/database");
class NewsletterService {
    async subscribeNewsletter(email, userId) {
        try {
            const existingSubscriber = await database_1.prisma.newsletter.findUnique({
                where: { email },
                include: {
                    user: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            role: true,
                        },
                    },
                },
            });
            if (existingSubscriber) {
                if (existingSubscriber.isActive) {
                    throw new Error("Email is already subscribed to newsletter");
                }
                else {
                    const reactivatedSubscriber = await database_1.prisma.newsletter.update({
                        where: { email },
                        data: {
                            isActive: true,
                            updatedAt: new Date(),
                            userId: userId || existingSubscriber.userId,
                        },
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    fullName: true,
                                    email: true,
                                    role: true,
                                },
                            },
                        },
                    });
                    return reactivatedSubscriber;
                }
            }
            const newSubscriber = await database_1.prisma.newsletter.create({
                data: {
                    email,
                    userId,
                    isActive: true,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            role: true,
                        },
                    },
                },
            });
            return newSubscriber;
        }
        catch (error) {
            throw new Error(error.message || "Failed to subscribe to newsletter");
        }
    }
    async getAllSubscribers() {
        try {
            const subscribers = await database_1.prisma.newsletter.findMany({
                include: {
                    user: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            role: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            });
            return subscribers;
        }
        catch (error) {
            throw new Error("Failed to fetch newsletter subscribers");
        }
    }
    async deleteSubscriber(id) {
        try {
            const subscriber = await database_1.prisma.newsletter.findUnique({
                where: { id },
            });
            if (!subscriber) {
                return {
                    success: false,
                    message: "Newsletter subscriber not found",
                };
            }
            await database_1.prisma.newsletter.delete({
                where: { id },
            });
            return {
                success: true,
                message: "Newsletter subscriber deleted successfully",
            };
        }
        catch (error) {
            throw new Error("Failed to delete newsletter subscriber");
        }
    }
    async getNewsletterStats(period = "monthly", startDate, endDate) {
        try {
            const now = new Date();
            let dateFilter = {};
            switch (period) {
                case "daily":
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    dateFilter = {
                        gte: today,
                        lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
                    };
                    break;
                case "weekly":
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    dateFilter = { gte: weekAgo };
                    break;
                case "monthly":
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    dateFilter = { gte: monthAgo };
                    break;
                case "yearly":
                    const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                    dateFilter = { gte: yearAgo };
                    break;
            }
            if (startDate && endDate) {
                dateFilter = {
                    gte: new Date(startDate),
                    lte: new Date(endDate),
                };
            }
            const totalSubscribers = await database_1.prisma.newsletter.count();
            const activeSubscribers = await database_1.prisma.newsletter.count({
                where: { isActive: true },
            });
            const inactiveSubscribers = totalSubscribers - activeSubscribers;
            const periodData = await database_1.prisma.newsletter.groupBy({
                by: ["createdAt"],
                where: {
                    createdAt: dateFilter,
                },
                _count: {
                    id: true,
                },
                orderBy: {
                    createdAt: "asc",
                },
            });
            const previousPeriodCount = await database_1.prisma.newsletter.count({
                where: {
                    createdAt: {
                        gte: new Date(now.getTime() - 2 * 30 * 24 * 60 * 60 * 1000),
                        lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
                    },
                },
            });
            const currentPeriodCount = await database_1.prisma.newsletter.count({
                where: {
                    createdAt: {
                        gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
                    },
                },
            });
            const growthRate = previousPeriodCount > 0
                ? ((currentPeriodCount - previousPeriodCount) / previousPeriodCount) *
                    100
                : 0;
            const unsubscribeRate = totalSubscribers > 0
                ? (inactiveSubscribers / totalSubscribers) * 100
                : 0;
            return {
                totalSubscribers,
                activeSubscribers,
                inactiveSubscribers,
                periodData: periodData.map((item) => ({
                    period: period,
                    count: item._count.id,
                    date: item.createdAt.toISOString().split("T")[0],
                })),
                growthRate: Math.round(growthRate * 100) / 100,
                unsubscribeRate: Math.round(unsubscribeRate * 100) / 100,
            };
        }
        catch (error) {
            throw new Error("Failed to fetch newsletter statistics");
        }
    }
}
exports.NewsletterService = NewsletterService;
//# sourceMappingURL=newsletter.service.js.map