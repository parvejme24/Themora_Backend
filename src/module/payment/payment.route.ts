import { Router } from "express";
import { optionalAuth } from "../../middleware/authMiddleware";
import { validateRequest } from "../../utils/validateRequest";
import {
  confirmStripeSession,
  createCheckout,
  createLegacyCheckout,
  getOrderStatus,
  sslcommerzCancel,
  sslcommerzFail,
  sslcommerzIpn,
  sslcommerzSuccess,
  stripeWebhook,
} from "./payment.controller";
import { checkoutSchema, legacyCheckoutSchema, orderIdParamSchema, stripeConfirmSchema } from "./payment.validation";

const router = Router();

// Checkout (guests allowed; signed-in users are linked automatically)
router.post("/checkout", optionalAuth, validateRequest({ body: checkoutSchema }), createCheckout);
router.post("/payments/checkout", optionalAuth, validateRequest({ body: legacyCheckoutSchema }), createLegacyCheckout);
router.get("/payments/orders/:id/status", validateRequest({ params: orderIdParamSchema }), getOrderStatus);

// Stripe
router.post("/webhooks/stripe", stripeWebhook);
router.post("/payments/stripe/confirm", validateRequest({ body: stripeConfirmSchema }), confirmStripeSession);

// SSLCommerz
router.post("/webhooks/sslcommerz", sslcommerzIpn);
router.post("/payments/sslcommerz/success", sslcommerzSuccess);
router.post("/payments/sslcommerz/fail", sslcommerzFail);
router.post("/payments/sslcommerz/cancel", sslcommerzCancel);

export default router;
