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

const router = Router();

// Top selling route (must be before /orders/:id)
router.get('/orders/top-selling', cacheResponse(30), optionalAuth, getTopSellingTemplates);

// Admin routes
router.get('/orders', authenticateAdminAndCheckStatus, validateOrderQuery, getAllOrders);
router.get('/orders/stats', authenticateAdminAndCheckStatus, getOrderStats);

// Order by ID route
router.get('/orders/:id', authenticateAndCheckStatus, validateOrderId, getOrderById);

// User routes
router.get('/user/orders', authenticateAndCheckStatus, validateOrderQuery, getUserOrders);

// Create order (user or admin)
router.post('/orders', authenticateAndCheckStatus, validateCreateOrder, createOrder);
router.patch('/orders/:id/status', authenticateAdminAndCheckStatus, validateOrderId, validateUpdateOrderStatus, updateOrderStatus);

export default router;
