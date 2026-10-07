import { z } from "zod";
export declare const createOrderSchema: z.ZodObject<{
    templateId: z.ZodOptional<z.ZodString>;
    pricingPlanId: z.ZodOptional<z.ZodString>;
    lemonsqueezyOrderId: z.ZodOptional<z.ZodString>;
    lemonsqueezyInvoiceId: z.ZodOptional<z.ZodString>;
    totalAmount: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodDefault<z.ZodString>;
    licenseType: z.ZodDefault<z.ZodEnum<{
        SINGLE: "SINGLE";
        EXTENDED: "EXTENDED";
    }>>;
    paymentMethod: z.ZodOptional<z.ZodString>;
    customerEmail: z.ZodOptional<z.ZodString>;
    customerName: z.ZodOptional<z.ZodString>;
    billingAddress: z.ZodOptional<z.ZodAny>;
    downloadLinks: z.ZodOptional<z.ZodArray<z.ZodString>>;
    expiresAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const updateOrderStatusSchema: z.ZodObject<{
    status: z.ZodEnum<{
        PENDING: "PENDING";
        PROCESSING: "PROCESSING";
        COMPLETED: "COMPLETED";
        CANCELLED: "CANCELLED";
        REFUNDED: "REFUNDED";
    }>;
}, z.core.$strip>;
export declare const orderIdSchema: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export declare const orderQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>, z.ZodNumber>>;
    limit: z.ZodDefault<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>, z.ZodNumber>>;
    status: z.ZodOptional<z.ZodEnum<{
        PENDING: "PENDING";
        PROCESSING: "PROCESSING";
        COMPLETED: "COMPLETED";
        CANCELLED: "CANCELLED";
        REFUNDED: "REFUNDED";
    }>>;
    userId: z.ZodOptional<z.ZodString>;
    templateId: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodDefault<z.ZodEnum<{
        createdAt: "createdAt";
        status: "status";
        totalAmount: "totalAmount";
    }>>;
    sortOrder: z.ZodDefault<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>;
}, z.core.$strip>;
export interface Order {
    id: string;
    userId?: string | null;
    templateId: string;
    lemonsqueezyOrderId: string;
    lemonsqueezyInvoiceId?: string | null;
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "CANCELLED" | "REFUNDED";
    totalAmount: number;
    currency: string;
    licenseType: "SINGLE" | "EXTENDED";
    paymentMethod?: string | null;
    customerEmail: string;
    customerName?: string | null;
    billingAddress?: any;
    downloadLinks: string[];
    expiresAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    user?: {
        id: string;
        fullName: string;
        email: string;
    } | null;
    template: {
        id: string;
        title: string;
        price: number;
        imageUrl?: string | null;
        shortDescription: string;
    };
    licenses: Array<{
        id: string;
        licenseKey: string;
        licenseType: "SINGLE" | "EXTENDED";
        isActive: boolean;
        expiresAt?: Date | null;
    }>;
}
export interface CreateOrderInput {
    templateId: string;
    lemonsqueezyOrderId: string;
    lemonsqueezyInvoiceId?: string;
    totalAmount: number;
    currency?: string;
    licenseType: "SINGLE" | "EXTENDED";
    paymentMethod?: string;
    customerEmail: string;
    customerName?: string;
    billingAddress?: any;
    downloadLinks?: string[];
    expiresAt?: string;
}
export interface UpdateOrderStatusInput {
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "CANCELLED" | "REFUNDED";
}
export interface OrderQuery {
    page: number;
    limit: number;
    status?: "PENDING" | "PROCESSING" | "COMPLETED" | "CANCELLED" | "REFUNDED";
    userId?: string;
    templateId?: string;
    sortBy: "createdAt" | "totalAmount" | "status";
    sortOrder: "asc" | "desc";
}
export interface PaginatedOrders {
    orders: Order[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}
export interface OrderStats {
    totalOrders: number;
    totalRevenue: number;
    ordersByStatus: Array<{
        status: string;
        count: number;
        revenue: number;
    }>;
    ordersByLicenseType: Array<{
        licenseType: string;
        count: number;
        revenue: number;
    }>;
}
//# sourceMappingURL=order.type.d.ts.map