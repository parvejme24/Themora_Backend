import { CreateCheckoutInput } from "./payment.type";
export declare class PaymentService {
    createCheckout(input: CreateCheckoutInput, user?: {
        id: string;
        email: string;
        fullName: string;
    }): Promise<{
        checkoutUrl: string;
        productTitle: string;
    }>;
}
export declare const paymentService: PaymentService;
//# sourceMappingURL=payment.service.d.ts.map