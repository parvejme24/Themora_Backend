import { prisma } from "../../config/database";
import crypto from "crypto";
import { env } from "../../config/env";
import { LemonSqueezyWebhookPayload, WebhookProcessingResult } from "./webhook.type";

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

  verifyFastSpringSignature(payload: Buffer, signature: string): boolean {
    const secret = process.env.FASTSPRING_WEBHOOK_SECRET;
    if (!secret || !signature) return true; // If no secret configured, accept
    try {
      const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64");
      return expected === signature;
    } catch {
      return false;
    }
  }

  async processFastSpringWebhook(body: any): Promise<WebhookProcessingResult> {
    try {
      const events = Array.isArray(body?.events) ? body.events : [body];
      for (const event of events) {
        if (event.type === "order.completed" || event.type === "order.updated") {
          const data = event.data;
          const orderId = data.order || data.reference || `FS-${Date.now()}`;
          const customerEmail = (data.customer?.email || "").trim().toLowerCase();
          const customerName = `${data.customer?.first || ""} ${data.customer?.last || ""}`.trim() || "Customer";
          const productId = data.tags?.product_id;
          const productType = data.tags?.product_type || "template";
          const userId = data.tags?.user_id || null;

          let template = null;
          let pricingPlan = null;

          if (productId) {
            if (productType === "template") {
              template = await prisma.template.findUnique({ where: { id: productId } });
            } else {
              pricingPlan = await prisma.pricingPlan.findUnique({ where: { id: productId } });
            }
          }

          const totalAmount = Number(data.total) || (template?.price ?? pricingPlan?.price ?? 0);

          const existing = await prisma.orderInvoice.findFirst({ where: { lemonsqueezyOrderId: orderId } });
          const order = existing
            ? await prisma.orderInvoice.update({
                where: { id: existing.id },
                data: { status: "COMPLETED", customerEmail, customerName },
              })
            : await prisma.orderInvoice.create({
                data: {
                  userId,
                  templateId: template?.id,
                  pricingPlanId: pricingPlan?.id,
                  lemonsqueezyOrderId: orderId,
                  lemonsqueezyInvoiceId: `INV-${orderId}`,
                  status: "COMPLETED",
                  totalAmount,
                  currency: data.currency || "USD",
                  licenseType: "SINGLE",
                  paymentMethod: "FastSpring",
                  customerEmail,
                  customerName,
                  billingAddress: { email: customerEmail, name: customerName },
                  downloadLinks: template?.sourceFiles?.map((_: any, idx: number) => String(idx)) || [],
                },
              });

          if (template) {
            let license = await prisma.license.findFirst({ where: { orderId: order.id } });
            if (!license) {
              await prisma.license.create({
                data: {
                  orderId: order.id,
                  templateId: template.id,
                  userId,
                  licenseType: "SINGLE",
                  licenseKey: this.generateLicenseKey(),
                  lemonsqueezyOrderId: orderId,
                  isActive: true,
                  maxUsage: 1,
                  activationLimit: 1,
                  usedCount: 0,
                },
              });
              await prisma.template.update({
                where: { id: template.id },
                data: { totalPurchase: { increment: 1 }, downloads: { increment: 1 } },
              }).catch(() => {});
            }
          } else if (pricingPlan) {
            const supportExpiresAt = new Date();
            supportExpiresAt.setFullYear(supportExpiresAt.getFullYear() + 1);
            await prisma.planEntitlement.upsert({
              where: { orderId: order.id },
              create: {
                pricingPlanId: pricingPlan.id,
                orderId: order.id,
                userId,
                customerEmail,
                websitesAllowed: pricingPlan.websiteLimit,
                supportExpiresAt,
                isActive: true,
              },
              update: { isActive: true },
            });
          }
        }
      }
      return { success: true, message: "FastSpring webhook processed successfully" };
    } catch (error) {
      console.error("FastSpring webhook error:", error);
      return { success: false, message: "Failed to process FastSpring webhook", error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  private determineLicenseType(variantName: string): "SINGLE" | "EXTENDED" {
    return /extended|commercial/i.test(variantName) ? "EXTENDED" : "SINGLE";
  }

  private generateLicenseKey(): string {
    return `THMR-${crypto.randomBytes(2).toString("hex").toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
  }
}
