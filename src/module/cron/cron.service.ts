import { prisma } from "../../config/database";
import { captureError } from "../../config/monitoring";
import { activeSalePrice } from "../../utils/pricing";
import { sendAbandonedCartEmail, sendSubscriptionReminderEmail } from "../../utils/email";

const DAY = 24 * 60 * 60 * 1000;
// Vercel functions have a time limit; cap the emails sent per run
const MAX_EMAILS_PER_JOB = 40;

/**
 * Daily maintenance. Every job is idempotent, so a retried or overlapping run
 * never emails twice or double-updates.
 */
export class CronService {
  // SSLCommerz passes (and Stripe subscriptions whose webhooks never arrived)
  async expireSubscriptions(now = new Date()) {
    const passes = await prisma.subscription.updateMany({
      where: { provider: { not: "STRIPE" }, status: { in: ["ACTIVE", "PAST_DUE"] }, currentPeriodEnd: { lt: now } },
      data: { status: "EXPIRED", autoRenew: false },
    });
    const stripe = await prisma.subscription.updateMany({
      where: { provider: "STRIPE", status: { in: ["ACTIVE", "PAST_DUE"] }, currentPeriodEnd: { lt: new Date(now.getTime() - 7 * DAY) } },
      data: { status: "EXPIRED", autoRenew: false },
    });
    return { expired: passes.count + stripe.count };
  }

  // Non-renewing passes ending within 3 days get one reminder
  async sendSubscriptionReminders(now = new Date()) {
    const due = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        autoRenew: false,
        reminderSentAt: null,
        currentPeriodEnd: { gt: now, lt: new Date(now.getTime() + 3 * DAY) },
      },
      take: MAX_EMAILS_PER_JOB,
      include: { user: { select: { email: true, fullName: true } }, pricingPlan: { select: { title: true } } },
    });

    let sent = 0;
    for (const subscription of due) {
      // Claim first, so an overlapping run skips this subscription
      const claimed = await prisma.subscription.updateMany({
        where: { id: subscription.id, reminderSentAt: null },
        data: { reminderSentAt: now },
      });
      if (claimed.count === 0) continue;
      try {
        await sendSubscriptionReminderEmail(subscription.user.email, subscription.user.fullName, subscription.pricingPlan.title, subscription.currentPeriodEnd);
        sent++;
      } catch (error) {
        console.error(`Subscription reminder to ${subscription.user.email} failed:`, error);
        await prisma.subscription.update({ where: { id: subscription.id }, data: { reminderSentAt: null } });
      }
    }
    return { sent };
  }

  // Carts last changed 1–3 days ago get one reminder
  async sendAbandonedCartReminders(now = new Date()) {
    const carts = await prisma.cart.findMany({
      where: {
        reminderSentAt: null,
        items: { some: {} },
        user: { isBanned: false, isTrashed: false },
      },
      include: {
        user: { select: { email: true, fullName: true } },
        items: {
          orderBy: { createdAt: "desc" },
          include: { product: { select: { title: true, price: true, salePrice: true, saleEndsAt: true, status: true } } },
        },
      },
    });

    const due = carts
      .filter((cart) => {
        const lastChange = cart.items[0].createdAt.getTime();
        return lastChange < now.getTime() - DAY && lastChange > now.getTime() - 3 * DAY;
      })
      .slice(0, MAX_EMAILS_PER_JOB);

    let sent = 0;
    for (const cart of due) {
      const items = cart.items
        .filter((item) => item.product.status === "PUBLISHED")
        .map((item) => ({ title: item.product.title, price: activeSalePrice(item.product) ?? item.product.price }));
      if (items.length === 0) continue;

      const claimed = await prisma.cart.updateMany({ where: { id: cart.id, reminderSentAt: null }, data: { reminderSentAt: now } });
      if (claimed.count === 0) continue;
      try {
        await sendAbandonedCartEmail(cart.user.email, cart.user.fullName, items);
        sent++;
      } catch (error) {
        console.error(`Cart reminder to ${cart.user.email} failed:`, error);
        await prisma.cart.update({ where: { id: cart.id }, data: { reminderSentAt: null } });
      }
    }
    return { sent };
  }

  // Checkouts left open for a day will never be paid
  async cancelStaleOrders(now = new Date()) {
    const result = await prisma.orderInvoice.updateMany({
      where: { status: "PENDING", createdAt: { lt: new Date(now.getTime() - DAY) } },
      data: { status: "CANCELLED", failureReason: "Checkout was not completed" },
    });
    return { cancelled: result.count };
  }

  async clearExpiredSales(now = new Date()) {
    const result = await prisma.template.updateMany({
      where: { salePrice: { not: null }, saleEndsAt: { lt: now } },
      data: { salePrice: null, saleEndsAt: null },
    });
    return { cleared: result.count };
  }

  // Processed webhook payloads are only needed for a while
  async pruneWebhookEvents(now = new Date()) {
    const result = await prisma.webhookEvent.deleteMany({
      where: { processedAt: { not: null }, createdAt: { lt: new Date(now.getTime() - 90 * DAY) } },
    });
    return { deleted: result.count };
  }

  async runDaily() {
    const jobs = {
      expireSubscriptions: () => this.expireSubscriptions(),
      subscriptionReminders: () => this.sendSubscriptionReminders(),
      abandonedCarts: () => this.sendAbandonedCartReminders(),
      staleOrders: () => this.cancelStaleOrders(),
      expiredSales: () => this.clearExpiredSales(),
      webhookEvents: () => this.pruneWebhookEvents(),
    };
    const results: Record<string, unknown> = {};
    // One failing job must not stop the others
    for (const [name, job] of Object.entries(jobs)) {
      try {
        results[name] = await job();
      } catch (error) {
        captureError(error, { cronJob: name });
        results[name] = { error: error instanceof Error ? error.message : "failed" };
      }
    }
    return results;
  }
}

export const cronService = new CronService();
