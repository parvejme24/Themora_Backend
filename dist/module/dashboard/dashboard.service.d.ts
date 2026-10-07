export declare class DashboardService {
    getDashboardOverview(): Promise<{
        stats: {
            totalUsers: number;
            activeUsers: number;
            totalTemplates: number;
            totalDownloads: number;
            totalOrders: number;
            grossRevenue: number;
            totalContacts: number;
            totalSubscribers: number;
        };
        userStats: import("../auth/auth.interface").IUserStats;
        templateStats: import("../template/template.type").TemplateStats;
        orderStats: import("../order/order.type").OrderStats;
        contactStats: import("../contact/contact.interface").IContactStats;
        newsletterStats: import("../newsletter/newsletter.type").NewsletterStats;
        revenueTimeline: {
            month: string;
            revenue: number;
        }[];
        recentOrders: ({
            user: {
                id: string;
                fullName: string;
                email: string;
            } | null;
            licenses: {
                id: string;
                isActive: boolean;
                licenseType: import(".prisma/client").$Enums.LicenseType;
                licenseKey: string;
            }[];
            template: {
                id: string;
                title: string;
                imageUrl: string | null;
                price: number;
            } | null;
            pricingPlan: {
                id: string;
                title: string;
                price: number;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string | null;
            expiresAt: Date | null;
            status: import(".prisma/client").$Enums.OrderStatus;
            templateId: string | null;
            pricingPlanId: string | null;
            lemonsqueezyOrderId: string;
            lemonsqueezyInvoiceId: string | null;
            totalAmount: number;
            currency: string;
            licenseType: import(".prisma/client").$Enums.LicenseType;
            paymentMethod: string | null;
            customerEmail: string;
            customerName: string | null;
            billingAddress: import("@prisma/client/runtime/library").JsonValue | null;
            downloadLinks: string[];
        })[];
    }>;
}
export declare const dashboardService: DashboardService;
//# sourceMappingURL=dashboard.service.d.ts.map