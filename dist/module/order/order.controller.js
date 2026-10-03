"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTopSellingTemplates = exports.getUserOrders = exports.getOrderStats = exports.updateOrderStatus = exports.createOrder = exports.getOrderById = exports.getAllOrders = void 0;
const order_service_1 = require("./order.service");
const orderService = new order_service_1.OrderService();
const getAllOrders = async (req, res) => {
    try {
        const query = req.validatedQuery || req.query;
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
    }
    catch (error) {
        console.error("Error fetching orders:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch orders",
            error: error.message,
        });
    }
};
exports.getAllOrders = getAllOrders;
const getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        if (user?.email)
            await orderService.claimGuestOrders(user.id, user.email);
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
    }
    catch (error) {
        console.error("Error fetching order:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch order",
            error: error.message,
        });
    }
};
exports.getOrderById = getOrderById;
const createOrder = async (req, res) => {
    try {
        const data = req.validatedData;
        const order = await orderService.createOrder(data);
        return res.status(201).json({
            success: true,
            message: "Order created successfully",
            data: order,
        });
    }
    catch (error) {
        console.error("Error creating order:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to create order",
        });
    }
};
exports.createOrder = createOrder;
const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.validatedData;
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
    }
    catch (error) {
        console.error("Error updating order status:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to update order status",
        });
    }
};
exports.updateOrderStatus = updateOrderStatus;
const getOrderStats = async (req, res) => {
    try {
        const stats = await orderService.getOrderStats();
        return res.status(200).json({
            success: true,
            message: "Order statistics fetched successfully",
            data: stats,
        });
    }
    catch (error) {
        console.error("Error fetching order statistics:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch order statistics",
            error: error.message,
        });
    }
};
exports.getOrderStats = getOrderStats;
const getUserOrders = async (req, res) => {
    try {
        const user = req.user;
        const userId = user?.id;
        if (!userId || !user.email) {
            return res.status(401).json({ success: false, message: "Authenticated account email is required" });
        }
        const query = req.validatedQuery || req.query;
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
    }
    catch (error) {
        console.error("Error fetching user orders:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch user orders",
            error: error.message,
        });
    }
};
exports.getUserOrders = getUserOrders;
const getTopSellingTemplates = async (req, res) => {
    try {
        const limit = Number(req.query.limit) || 5;
        const result = await orderService.getTopSellingTemplates(limit);
        return res.status(200).json({
            success: true,
            message: "Top selling templates fetched successfully",
            data: result,
        });
    }
    catch (error) {
        console.error("Error fetching top selling templates:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch top selling templates",
            error: error.message,
        });
    }
};
exports.getTopSellingTemplates = getTopSellingTemplates;
//# sourceMappingURL=order.controller.js.map