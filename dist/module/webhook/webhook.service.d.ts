import { LemonSqueezyWebhookPayload, WebhookProcessingResult } from "./webhook.type";
export declare class WebhookService {
    verifyWebhookSignature(payload: Buffer, signature: string): boolean;
    processOrderCreated(payload: LemonSqueezyWebhookPayload): Promise<WebhookProcessingResult>;
    processOrderUpdated(payload: LemonSqueezyWebhookPayload): Promise<WebhookProcessingResult>;
    private mapLemonSqueezyStatus;
    verifyFastSpringSignature(payload: Buffer, signature: string): boolean;
    processFastSpringWebhook(body: any): Promise<WebhookProcessingResult>;
    private determineLicenseType;
    private generateLicenseKey;
}
//# sourceMappingURL=webhook.service.d.ts.map