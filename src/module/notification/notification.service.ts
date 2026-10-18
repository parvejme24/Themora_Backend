import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/AppError";
import { buildPaginationMeta } from "../../utils/pagination";

export type NotificationType =
  | "order_completed"
  | "refund_update"
  | "product_update"
  | "ticket_reply"
  | "ticket_assigned"
  | "payout_paid"
  | "subscription";

interface NotificationInput {
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}

type Db = Prisma.TransactionClient | typeof prisma;

export class NotificationService {
  // In-app notifications are best effort: a failure never breaks the action
  async notify(userId: string | null | undefined, input: NotificationInput, db: Db = prisma) {
    if (!userId) return;
    try {
      await db.notification.create({ data: { userId, ...input } });
    } catch (error) {
      console.error("Could not create notification:", error);
    }
  }

  async notifyMany(userIds: string[], input: NotificationInput) {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return;
    await prisma.notification.createMany({ data: unique.map((userId) => ({ userId, ...input })) });
  }

  async list(userId: string, query: { unread?: boolean; page: number; limit: number }) {
    const where: Prisma.NotificationWhereInput = { userId, ...(query.unread ? { readAt: null } : {}) };
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { notifications, unreadCount, pagination: buildPaginationMeta(total, query.page, query.limit) };
  }

  async markRead(userId: string, id: string) {
    const result = await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
    if (result.count === 0 && !(await prisma.notification.findFirst({ where: { id, userId }, select: { id: true } }))) {
      throw AppError.notFound("Notification not found");
    }
  }

  async markAllRead(userId: string) {
    const result = await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { updated: result.count };
  }
}

export const notificationService = new NotificationService();
