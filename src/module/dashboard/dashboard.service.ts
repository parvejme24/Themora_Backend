import { prisma } from "../../config/database";
import { authService } from "../auth/auth.service";
import { templateService } from "../template/template.service";
import { orderService } from "../order/order.service";
import { contactService } from "../contact/contact.service";
import { newsletterService } from "../newsletter/newsletter.service";

export class DashboardService {
  async getDashboardOverview() {
    const [
      userStats,
      templateStats,
      orderStats,
      contactStats,
      newsletterStats,
      recentOrders,
    ] = await Promise.all([
      authService.getUserStats(),
      templateService.getTemplateStats(),
      orderService.getOrderStats(),
      contactService.getContactStats(),
      newsletterService.getNewsletterStats("monthly"),
      prisma.orderInvoice.findMany({
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

    // Calculate 6-month monthly revenue timeline chart data
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const completedOrders = await prisma.orderInvoice.findMany({
      where: {
        status: "COMPLETED",
        createdAt: { gte: sixMonthsAgo },
      },
      select: {
        totalAmount: true,
        createdAt: true,
      },
    });

    const monthlyRevenueMap: Record<string, number> = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Initialize 6 months in chronological order
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

export const dashboardService = new DashboardService();
