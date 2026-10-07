import { Request, Response } from "express";
import { OrderService } from "./order.service";

const orderService = new OrderService();

// Get all orders
export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const query = (req as any).validatedQuery || req.query;
    const { page = 1, limit = 10, status, userId, templateId, sortBy, sortOrder } = query;

    const result = await orderService.getAllOrders({
      page,
      limit,
      status,
      userId,
      templateId,
      sortBy,
      sortOrder,
    });

    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      data: result.orders,
      pagination: result.pagination,
    });
  } catch (error: any) {
    console.error("Error fetching orders:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

// Get order by ID
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    if (user?.email) await orderService.claimGuestOrders(user.id, user.email);

    const order = await orderService.getOrderById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
        data: null,
      });
    }

    if (user && user.role !== "ADMIN" && order.userId && order.userId !== user.id && order.customerEmail?.toLowerCase() !== user.email?.toLowerCase()) {
      return res.status(404).json({ success: false, message: "Order not found", data: null });
    }

    return res.status(200).json({
      success: true,
      message: "Order fetched successfully",
      data: order,
    });
  } catch (error: any) {
    console.error("Error fetching order:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      error: error.message,
    });
  }
};

// Create order
export const createOrder = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const data = (req as any).validatedData || req.body;

    if (user) {
      data.userId = data.userId || user.id;
      data.customerEmail = data.customerEmail || user.email;
      data.customerName = data.customerName || user.fullName;
    }

    if (!data.lemonsqueezyOrderId) {
      data.lemonsqueezyOrderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    }

    if (data.templateId && (!data.totalAmount || data.totalAmount <= 0)) {
      const { prisma } = await import("../../config/database");
      const template = await prisma.template.findUnique({ where: { id: data.templateId } });
      if (template) {
        data.totalAmount = data.licenseType === "EXTENDED" ? template.price * 2 : template.price;
        if (!data.downloadLinks || data.downloadLinks.length === 0) {
          data.downloadLinks = template.sourceFiles || [];
        }
      }
    }

    if (!data.totalAmount) {
      data.totalAmount = 49.0;
    }

    const order = await orderService.createOrder(data);

    // Issue license key if order is created
    if (order) {
      const { prisma } = await import("../../config/database");
      const licenseKey = `THM-${(order.licenseType || "STD").substring(0, 3)}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      await prisma.license.create({
        data: {
          orderId: order.id,
          templateId: order.templateId || (data.templateId || null),
          userId: order.userId || (user ? user.id : null),
          licenseType: order.licenseType || "SINGLE",
          licenseKey,
          lemonsqueezyOrderId: order.lemonsqueezyOrderId,
          isActive: true,
          maxUsage: order.licenseType === "EXTENDED" ? 10 : 1,
        },
      });
    }

    const freshOrder = await orderService.getOrderById(order.id);

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: freshOrder || order,
    });
  } catch (error: any) {
    console.error("Error creating order:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create order",
    });
  }
};

// Update order status
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = (req as any).validatedData;

    const order = await orderService.updateOrderStatus(id, data);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error: any) {
    console.error("Error updating order status:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update order status",
    });
  }
};

// Get order statistics
export const getOrderStats = async (req: Request, res: Response) => {
  try {
    const stats = await orderService.getOrderStats();

    return res.status(200).json({
      success: true,
      message: "Order statistics fetched successfully",
      data: stats,
    });
  } catch (error: any) {
    console.error("Error fetching order statistics:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch order statistics",
      error: error.message,
    });
  }
};

// Get user orders
export const getUserOrders = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.id;
    if (!userId || !user.email) {
      return res.status(401).json({ success: false, message: "Authenticated account email is required" });
    }
    const query = (req as any).validatedQuery || req.query;
    const { page = 1, limit = 10, status, templateId, sortBy, sortOrder } = query;

    const result = await orderService.getUserOrders(userId, user.email, {
      page,
      limit,
      status,
      templateId,
      sortBy,
      sortOrder,
    });

    return res.status(200).json({
      success: true,
      message: "User orders fetched successfully",
      data: result.orders,
      pagination: result.pagination,
    });
  } catch (error: any) {
    console.error("Error fetching user orders:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user orders",
      error: error.message,
    });
  }
};

// Get top selling templates
export const getTopSellingTemplates = async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 5;
    const result = await orderService.getTopSellingTemplates(limit);
    return res.status(200).json({
      success: true,
      message: "Top selling templates fetched successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Error fetching top selling templates:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch top selling templates",
      error: error.message,
    });
  }
};
