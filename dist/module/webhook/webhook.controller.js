"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testWebhook = exports.handleFastSpringWebhook = exports.handleLemonSqueezyWebhook = void 0;
const webhook_service_1 = require("./webhook.service");
const webhook_type_1 = require("./webhook.type");
const webhookService = new webhook_service_1.WebhookService();
const handleLemonSqueezyWebhook = async (req, res) => {
    try {
        const signature = req.headers["x-signature"];
        const payload = req.rawBody;
        if (!payload || !webhookService.verifyWebhookSignature(payload, signature)) {
            console.error("Invalid webhook signature");
            return res.status(401).json({
                success: false,
                message: "Invalid webhook signature",
            });
        }
        const validatedPayload = webhook_type_1.lemonsqueezyWebhookSchema.parse(req.body);
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
        }
        else {
            console.error(`Webhook processing failed: ${result.message}`);
            return res.status(400).json({
                success: false,
                message: result.message,
                error: result.error,
            });
        }
    }
    catch (error) {
        console.error("Error processing Lemon Squeezy webhook:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error processing webhook",
            error: error.message,
        });
    }
};
exports.handleLemonSqueezyWebhook = handleLemonSqueezyWebhook;
const handleFastSpringWebhook = async (req, res) => {
    try {
        const signature = (req.headers["x-fs-signature"] || req.headers["x-signature"]);
        const rawPayload = req.rawBody;
        if (rawPayload && signature && !webhookService.verifyFastSpringSignature(rawPayload, signature)) {
            console.warn("FastSpring webhook signature mismatch");
        }
        const result = await webhookService.processFastSpringWebhook(req.body);
        if (result.success) {
            return res.status(200).json({ success: true, message: result.message });
        }
        else {
            return res.status(400).json({ success: false, message: result.message, error: result.error });
        }
    }
    catch (error) {
        console.error("Error processing FastSpring webhook:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};
exports.handleFastSpringWebhook = handleFastSpringWebhook;
const testWebhook = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            message: "Webhook endpoint is working",
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error("Error in test webhook:", error);
        return res.status(500).json({
            success: false,
            message: "Test webhook failed",
            error: error.message,
        });
    }
};
exports.testWebhook = testWebhook;
//# sourceMappingURL=webhook.controller.js.map