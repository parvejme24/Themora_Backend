import { Router } from 'express';
import {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  getOrderStats,
  getUserOrders,
} from './order.controller';
import { authenticateAndCheckStatus, authenticateAdminAndCheckStatus } from '../../middleware/authMiddleware';
import {
  validateCreateOrder,
  validateUpdateOrderStatus,
  validateOrderId,
  validateOrderQuery,
} from './order.validate';

const router = Router();

// Admin routes
router.get('/orders', authenticateAdminAndCheckStatus, validateOrderQuery, getAllOrders);
router.get('/orders/stats', authenticateAdminAndCheckStatus, getOrderStats);
router.get('/orders/:id', authenticateAndCheckStatus, validateOrderId, getOrderById);

// User routes
router.get('/user/orders', authenticateAndCheckStatus, validateOrderQuery, getUserOrders);

// Admin routes
router.post('/orders', authenticateAdminAndCheckStatus, validateCreateOrder, createOrder);
router.patch('/orders/:id/status', authenticateAdminAndCheckStatus, validateOrderId, validateUpdateOrderStatus, updateOrderStatus);

export default router;
