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
import { env } from "../../config/env";
import { sendResponse } from "../../utils/sendResponse";

const router = Router();

// What the checkout page needs to show prices and gateways: SSLCommerz
// (bKash, Nagad, local cards) charges in BDT at this rate
router.get("/payments/config", (_req, res) => {
  sendResponse(res, {
    message: "Payment settings fetched",
    data: {
      currency: "USD",
      usdToBdtRate: env.USD_TO_BDT_RATE,
      gateways: {
        stripe: { enabled: Boolean(env.STRIPE_SECRET_KEY) },
        sslcommerz: { enabled: Boolean(env.SSLCOMMERZ_STORE_ID && env.SSLCOMMERZ_STORE_PASSWORD), sandbox: env.SSLCOMMERZ_SANDBOX },
      },
    },
  });
});

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
