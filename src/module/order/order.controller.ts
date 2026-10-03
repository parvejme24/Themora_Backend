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

    if (user?.role !== "ADMIN" && order.userId !== user?.id) {
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
    const data = (req as any).validatedData;

    const order = await orderService.createOrder(data);

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: order,
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

