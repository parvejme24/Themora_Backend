import { z } from "zod";

// Order validation schemas
export const createOrderSchema = z.object({
  templateId: z.string().uuid("Invalid template ID").optional(),
  pricingPlanId: z.string().uuid("Invalid pricing plan ID").optional(),
  lemonsqueezyOrderId: z.string().optional(),
  lemonsqueezyInvoiceId: z.string().optional(),
  totalAmount: z.number().positive("Total amount must be positive").optional(),
  currency: z.string().default("USD"),
  licenseType: z.enum(["SINGLE", "EXTENDED"]).default("SINGLE"),
  paymentMethod: z.string().optional(),
  customerEmail: z.string().email("Invalid email address").optional(),
  customerName: z.string().optional(),
  billingAddress: z.any().optional(),
  downloadLinks: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "CANCELLED", "REFUNDED"]),
});

export const orderIdSchema = z.object({
  id: z.string().min(1, "Order ID is required"),
});

export const orderQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).default(1),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).default(10),
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "CANCELLED", "REFUNDED"]).optional(),
  userId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  sortBy: z.enum(["createdAt", "totalAmount", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// Order interfaces
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

