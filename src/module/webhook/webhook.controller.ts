import { Request, Response } from "express";
import { WebhookService } from "./webhook.service";
import { lemonsqueezyWebhookSchema } from "./webhook.type";

const webhookService = new WebhookService();

// Lemon Squeezy webhook handler
export const handleLemonSqueezyWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-signature"] as string;
    const payload = (req as any).rawBody as Buffer | undefined;

    // Verify webhook signature
    if (!payload || !webhookService.verifyWebhookSignature(payload, signature)) {
      console.error("Invalid webhook signature");
      return res.status(401).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    // Validate payload structure
    const validatedPayload = lemonsqueezyWebhookSchema.parse(req.body);
    const { meta, data } = validatedPayload;

    console.log(`Processing Lemon Squeezy webhook: ${meta.event_name} for order ${data.id}`);

    let result;

    switch (meta.event_name) {
      case "order_created":
        result = await webhookService.processOrderCreated(validatedPayload);
        break;
      case "order_updated":
        result = await webhookService.processOrderUpdated(validatedPayload);
        break;
      case "order_refunded":
        result = await webhookService.processOrderUpdated(validatedPayload);
        break;
      default:
        console.log(`Unhandled webhook event: ${meta.event_name}`);
        return res.status(200).json({
          success: true,
          message: "Webhook received but not processed",
        });
    }

    if (result.success) {
      console.log(`Webhook processed successfully: ${result.message}`);
      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          orderId: result.orderId,
          licenseIds: result.licenseIds,
        },
      });
    } else {
      console.error(`Webhook processing failed: ${result.message}`);
      return res.status(400).json({
        success: false,
        message: result.message,
        error: result.error,
      });
    }
  } catch (error: any) {
    console.error("Error processing Lemon Squeezy webhook:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error processing webhook",
      error: error.message,
    });
  }
};

// Test webhook endpoint (for development)
export const testWebhook = async (req: Request, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      message: "Webhook endpoint is working",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in test webhook:", error);
    return res.status(500).json({
      success: false,
      message: "Test webhook failed",
      error: error.message,
    });
  }
};
