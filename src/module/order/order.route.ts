import { Router } from 'express';
import {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  getOrderStats,
  getUserOrders,
  getTopSellingTemplates,
} from './order.controller';
import { authenticateAndCheckStatus, authenticateAdminAndCheckStatus, optionalAuth } from '../../middleware/authMiddleware';
import {
  validateCreateOrder,
  validateUpdateOrderStatus,
  validateOrderId,
  validateOrderQuery,
} from './order.validate';

import { cacheResponse } from '../../middleware/cache';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendResponse } from '../../utils/sendResponse';
import { validateRequest } from '../../utils/validateRequest';
import { myOrdersService } from './my-orders.service';
import { adminOrdersService } from './admin-orders.service';
import { authorize } from '../../middleware/permissions';

const router = Router();

// Buyer dashboard: orders with line items, licences and refund status
export const myOrdersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED']).optional(),
});
const buyerOf = (req: any) => req.user as { id: string; email: string };

router.get(
  '/me/orders',
  authenticateAndCheckStatus,
  validateRequest({ query: myOrdersQuery }),
  asyncHandler(async (req, res) => {
    const { orders, pagination } = await myOrdersService.list(buyerOf(req), (req as any).validatedQuery);
    sendResponse(res, { message: 'Orders fetched', data: orders, pagination });
  })
);
router.get(
  '/me/orders/:id',
  authenticateAndCheckStatus,
  validateRequest({ params: z.object({ id: z.string().uuid('Invalid order ID') }) }),
  asyncHandler(async (req, res) => {
    sendResponse(res, { message: 'Order fetched', data: await myOrdersService.get(buyerOf(req), req.params.id) });
  })
);

// Top selling route (must be before /orders/:id)
// Staff order management (support permission, same as the refund queue)
export const adminOrderQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED']).optional(),
  provider: z.enum(['STRIPE', 'SSLCOMMERZ', 'FREE', 'MANUAL']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const adminRefundOrderSchema = z.object({
  reason: z.string().trim().min(5, 'Say why the order is refunded').max(1000),
});
const orderIdParam = z.object({ id: z.string().uuid('Invalid order ID') });

router.get(
  '/admin/orders',
  authorize('support'),
  validateRequest({ query: adminOrderQuerySchema }),
  asyncHandler(async (req, res) => {
    const { orders, counts, pagination } = await adminOrdersService.list((req as any).validatedQuery);
    res.json({ success: true, message: 'Orders fetched', data: orders, counts, pagination });
  })
);
router.get(
  '/admin/orders/:id',
  authorize('support'),
  validateRequest({ params: orderIdParam }),
  asyncHandler(async (req, res) => {
    sendResponse(res, { message: 'Order fetched', data: await adminOrdersService.get(req.params.id) });
  })
);
router.post(
  '/admin/orders/:id/refund',
  authorize('support'),
  validateRequest({ params: orderIdParam, body: adminRefundOrderSchema }),
  asyncHandler(async (req, res) => {
    const staff = (req as any).user as { id: string };
    const refund = await adminOrdersService.refund(req.params.id, staff.id, (req as any).validatedData.reason);
    sendResponse(res, { message: 'Order refunded', data: refund });
  })
);

router.get('/orders/top-selling', cacheResponse(30), optionalAuth, getTopSellingTemplates);

// Admin routes
router.get('/orders', authenticateAdminAndCheckStatus, validateOrderQuery, getAllOrders);
router.get('/orders/stats', authenticateAdminAndCheckStatus, getOrderStats);

// Order by ID route (supports both auth users, admin, and guest checkout success verification)
router.get('/orders/:id', optionalAuth, validateOrderId, getOrderById);

// User routes
router.get('/user/orders', authenticateAndCheckStatus, validateOrderQuery, getUserOrders);

// Create order (user or admin)
router.post('/orders', authenticateAdminAndCheckStatus, validateCreateOrder, createOrder);
router.patch('/orders/:id/status', authenticateAdminAndCheckStatus, validateOrderId, validateUpdateOrderStatus, updateOrderStatus);

export default router;
