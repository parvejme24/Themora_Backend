"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardService = exports.DashboardService = void 0;
const database_1 = require("../../config/database");
const auth_service_1 = require("../auth/auth.service");
const template_service_1 = require("../template/template.service");
const order_service_1 = require("../order/order.service");
const contact_service_1 = require("../contact/contact.service");
const newsletter_service_1 = require("../newsletter/newsletter.service");
class DashboardService {
    async getDashboardOverview() {
        const [userStats, templateStats, orderStats, contactStats, newsletterStats, recentOrders,] = await Promise.all([
            auth_service_1.authService.getUserStats(),
            template_service_1.templateService.getTemplateStats(),
            order_service_1.orderService.getOrderStats(),
            contact_service_1.contactService.getContactStats(),
            newsletter_service_1.newsletterService.getNewsletterStats("monthly"),
            database_1.prisma.orderInvoice.findMany({
                take: 6,
                orderBy: { createdAt: "desc" },
                include: {
                    user: { select: { id: true, fullName: true, email: true } },
                    template: { select: { id: true, title: true, imageUrl: true, price: true } },
                    pricingPlan: { select: { id: true, title: true, price: true } },
                    licenses: { select: { id: true, licenseKey: true, licenseType: true, isActive: true } },
                },
            }),
        ]);
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        sixMonthsAgo.setHours(0, 0, 0, 0);
        const completedOrders = await database_1.prisma.orderInvoice.findMany({
            where: {
                status: "COMPLETED",
                createdAt: { gte: sixMonthsAgo },
            },
            select: {
                totalAmount: true,
                createdAt: true,
            },
        });
        const monthlyRevenueMap = {};
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
            monthlyRevenueMap[key] = 0;
        }
        completedOrders.forEach((o) => {
            const d = new Date(o.createdAt);
            const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
            if (monthlyRevenueMap[key] !== undefined) {
                monthlyRevenueMap[key] += o.totalAmount;
            }
        });
        const revenueTimeline = Object.entries(monthlyRevenueMap).map(([month, revenue]) => ({
            month,
            revenue,
        }));
        return {
            stats: {
                totalUsers: userStats.totalUsers,
                activeUsers: userStats.activeUsers,
                totalTemplates: templateStats.totalTemplates,
                totalDownloads: templateStats.totalDownloads,
                totalOrders: orderStats.totalOrders,
                grossRevenue: orderStats.totalRevenue,
                totalContacts: contactStats.totalContacts,
                totalSubscribers: newsletterStats.totalSubscribers,
            },
            userStats,
            templateStats,
            orderStats,
            contactStats,
            newsletterStats,
            revenueTimeline,
            recentOrders,
        };
    }
}
exports.DashboardService = DashboardService;
exports.dashboardService = new DashboardService();
//# sourceMappingURL=dashboard.service.js.map