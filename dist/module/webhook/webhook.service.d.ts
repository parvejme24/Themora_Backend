import { LemonSqueezyWebhookPayload, WebhookProcessingResult } from "./webhook.type";
export declare class WebhookService {
    verifyWebhookSignature(payload: Buffer, signature: string): boolean;
    processOrderCreated(payload: LemonSqueezyWebhookPayload): Promise<WebhookProcessingResult>;
    processOrderUpdated(payload: LemonSqueezyWebhookPayload): Promise<WebhookProcessingResult>;
    private mapLemonSqueezyStatus;
    private determineLicenseType;
    private generateLicenseKey;
}
//# sourceMappingURL=webhook.service.d.ts.map