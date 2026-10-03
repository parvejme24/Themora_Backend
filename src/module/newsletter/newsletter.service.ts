import { prisma } from "../../config/database";
import { INewsletterService } from "./newsletter.interface";
import { NewsletterSubscriber, NewsletterStats } from "./newsletter.type";

export class NewsletterService implements INewsletterService {
  // Subscribe to newsletter
  async subscribeNewsletter(email: string, userId?: string): Promise<NewsletterSubscriber> {
    try {
      // Check if email already exists
      const existingSubscriber = await prisma.newsletter.findUnique({
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
        } else {
          // Reactivate subscription and update user link if provided
          const reactivatedSubscriber = await prisma.newsletter.update({
            where: { email },
            data: { 
              isActive: true, 
              updatedAt: new Date(),
              userId: userId || existingSubscriber.userId, // Keep existing userId or update with new one
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

      // Create new subscription
      const newSubscriber = await prisma.newsletter.create({
        data: {
          email,
          userId, // Link to user account if provided
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
    } catch (error: any) {
      throw new Error(error.message || "Failed to subscribe to newsletter");
    }
  }

  // Get all newsletter subscribers
  async getAllSubscribers(): Promise<NewsletterSubscriber[]> {
    try {
      const subscribers = await prisma.newsletter.findMany({
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
    } catch (error: any) {
      throw new Error("Failed to fetch newsletter subscribers");
    }
  }

  // Delete newsletter subscriber
  async deleteSubscriber(
    id: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const subscriber = await prisma.newsletter.findUnique({
        where: { id },
      });

      if (!subscriber) {
        return {
          success: false,
          message: "Newsletter subscriber not found",
        };
      }

      await prisma.newsletter.delete({
        where: { id },
      });

      return {
        success: true,
        message: "Newsletter subscriber deleted successfully",
      };
    } catch (error: any) {
      throw new Error("Failed to delete newsletter subscriber");
    }
  }

  // Get newsletter statistics
  async getNewsletterStats(
    period: string = "monthly",
    startDate?: string,
    endDate?: string
  ): Promise<NewsletterStats> {
    try {
      const now = new Date();
      let dateFilter: any = {};

      // Set date range based on period
      switch (period) {
        case "daily":
          const today = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          );
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

      // Override with custom date range if provided
      if (startDate && endDate) {
        dateFilter = {
          gte: new Date(startDate),
          lte: new Date(endDate),
        };
      }

      // Get total counts
      const totalSubscribers = await prisma.newsletter.count();
      const activeSubscribers = await prisma.newsletter.count({
        where: { isActive: true },
      });
      const inactiveSubscribers = totalSubscribers - activeSubscribers;

      // Get period data
      const periodData = await prisma.newsletter.groupBy({
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

      // Calculate growth rate (simplified)
      const previousPeriodCount = await prisma.newsletter.count({
        where: {
          createdAt: {
            gte: new Date(now.getTime() - 2 * 30 * 24 * 60 * 60 * 1000), // 2 months ago
            lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 1 month ago
          },
        },
      });

      const currentPeriodCount = await prisma.newsletter.count({
        where: {
          createdAt: {
            gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // Last month
          },
        },
      });

      const growthRate =
        previousPeriodCount > 0
          ? ((currentPeriodCount - previousPeriodCount) / previousPeriodCount) *
            100
          : 0;

      // Calculate unsubscribe rate (simplified)
      const unsubscribeRate =
        totalSubscribers > 0
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
    } catch (error: any) {
      throw new Error("Failed to fetch newsletter statistics");
    }
  }
}
