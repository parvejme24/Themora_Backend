import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { env } from "../../config/env";
import { LemonSqueezyWebhookPayload, WebhookProcessingResult } from "./webhook.type";

const prisma = new PrismaClient();

export class WebhookService {
  verifyWebhookSignature(payload: Buffer, signature: string): boolean {
    if (!env.LEMONSQUEEZY_WEBHOOK_SECRET || !signature) return false;
    const expected = crypto.createHmac("sha256", env.LEMONSQUEEZY_WEBHOOK_SECRET).update(payload).digest();
    const received = Buffer.from(signature, "hex");
    return received.length === expected.length && crypto.timingSafeEqual(received, expected);
  }

  async processOrderCreated(payload: LemonSqueezyWebhookPayload): Promise<WebhookProcessingResult> {
    try {
      const { data } = payload;
      const { attributes } = data;
      const variantId = attributes.first_order_item.variant_id.toString();
      const customerEmail = attributes.user_email.trim().toLowerCase();
      const [template, pricingPlan, user] = await Promise.all([
        prisma.template.findFirst({ where: { lemonsqueezyVariantId: variantId } }),
        prisma.pricingPlan.findFirst({ where: { lemonsqueezyVariantId: variantId } }),
        prisma.user.findUnique({ where: { email: customerEmail }, select: { id: true } }),
      ]);

      if (Boolean(template) === Boolean(pricingPlan)) {
        return { success: false, message: "Product variant is not uniquely configured", error: `Variant ${variantId} must map to exactly one product` };
      }

      const existing = await prisma.orderInvoice.findUnique({ where: { lemonsqueezyOrderId: data.id } });
      const orderStatus = this.mapLemonSqueezyStatus(attributes.status, attributes.refunded);
      const wasCompleted = existing?.status === "COMPLETED";
      const order = existing
        ? await prisma.orderInvoice.update({
            where: { id: existing.id },
            data: { status: orderStatus, customerEmail, customerName: attributes.user_name, userId: user?.id ?? existing.userId },
          })
        : await prisma.orderInvoice.create({
            data: {
              userId: user?.id,
              templateId: template?.id,
              pricingPlanId: pricingPlan?.id,
              lemonsqueezyOrderId: data.id,
              lemonsqueezyInvoiceId: data.id,
              status: orderStatus,
              totalAmount: attributes.total_usd / 100,
              currency: "USD",
              licenseType: template ? this.determineLicenseType(attributes.first_order_item.variant_name) : "SINGLE",
              paymentMethod: "Lemon Squeezy",
              customerEmail,
              customerName: attributes.user_name,
              billingAddress: { email: customerEmail, name: attributes.user_name },
              downloadLinks: [],
            },
          });

      if (order.status !== "COMPLETED") {
        return { success: true, message: "Order recorded; fulfillment awaits confirmed payment", orderId: order.id };
      }

      if (pricingPlan) {
        const supportExpiresAt = new Date();
        supportExpiresAt.setFullYear(supportExpiresAt.getFullYear() + 1);
        await prisma.planEntitlement.upsert({
          where: { orderId: order.id },
          create: {
            pricingPlanId: pricingPlan.id,
            orderId: order.id,
            userId: user?.id,
            customerEmail,
            websitesAllowed: pricingPlan.websiteLimit,
            supportExpiresAt,
          },
          update: { userId: user?.id, customerEmail, isActive: true },
        });
      } else if (template) {
        let license = await prisma.license.findFirst({ where: { orderId: order.id, templateId: template.id } });
        if (!license) {
          const licenseType = this.determineLicenseType(attributes.first_order_item.variant_name);
          license = await prisma.license.create({
            data: {
              orderId: order.id,
              templateId: template.id,
              userId: user?.id,
              licenseType,
              licenseKey: this.generateLicenseKey(),
              lemonsqueezyOrderId: data.id,
              isActive: true,
              maxUsage: licenseType === "SINGLE" ? 1 : null,
              activationLimit: licenseType === "SINGLE" ? 1 : null,
              usedCount: 0,
            },
          });
          await prisma.orderInvoice.update({
            where: { id: order.id },
            data: { downloadLinks: template.sourceFiles.map((_, index) => String(index)) },
          });
        }
        if (!wasCompleted) {
          await prisma.template.update({ where: { id: template.id }, data: { totalPurchase: { increment: 1 } } });
        }
        return { success: true, message: "Paid order and theme license fulfilled", orderId: order.id, licenseIds: [license.id] };
      }

      return { success: true, message: "Paid plan order fulfilled", orderId: order.id };
    } catch (error) {
      console.error("Error processing Lemon Squeezy order:", error);
      return { success: false, message: "Failed to process order", error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async processOrderUpdated(payload: LemonSqueezyWebhookPayload): Promise<WebhookProcessingResult> {
    const result = await this.processOrderCreated(payload);
    if (!result.success || !result.orderId) return result;

    const { attributes } = payload.data;
    if (attributes.refunded || this.mapLemonSqueezyStatus(attributes.status, false) === "REFUNDED") {
      await Promise.all([
        prisma.license.updateMany({ where: { orderId: result.orderId }, data: { isActive: false } }),
        prisma.planEntitlement.updateMany({ where: { orderId: result.orderId }, data: { isActive: false } }),
      ]);
    }
    return { ...result, message: "Order status and entitlements updated" };
  }

  private mapLemonSqueezyStatus(status: string, refunded: boolean): "PENDING" | "PROCESSING" | "COMPLETED" | "CANCELLED" | "REFUNDED" {
    if (refunded || status.toLowerCase() === "refunded") return "REFUNDED";
    switch (status.toLowerCase()) {
      case "paid":
      case "completed":
        return "COMPLETED";
      case "processing":
        return "PROCESSING";
      case "cancelled":
        return "CANCELLED";
      default:
        return "PENDING";
    }
  }

  private determineLicenseType(variantName: string): "SINGLE" | "EXTENDED" {
    return /extended|commercial/i.test(variantName) ? "EXTENDED" : "SINGLE";
  }

  private generateLicenseKey(): string {
    return `TF-${crypto.randomUUID().toUpperCase()}`;
  }
}
