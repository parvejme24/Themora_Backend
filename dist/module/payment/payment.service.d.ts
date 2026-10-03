import { CreateCheckoutInput } from "./payment.type";
export declare class PaymentService {
    private generateLicenseKey;
    createCheckout(input: CreateCheckoutInput, user?: {
        id: string;
        email: string;
        fullName: string;
    }): Promise<{
        checkoutUrl: string;
        productTitle: string;
        gateway: string;
        orderId?: undefined;
    } | {
        checkoutUrl: string;
        productTitle: string;
        orderId: string;
        gateway: string;
    }>;
}
export declare const paymentService: PaymentService;
//# sourceMappingURL=payment.service.d.ts.map