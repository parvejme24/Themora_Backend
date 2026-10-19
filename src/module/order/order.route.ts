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
