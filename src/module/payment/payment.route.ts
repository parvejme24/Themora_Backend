import { Router } from "express";
import { optionalAuth } from "../../middleware/authMiddleware";
import { createCheckout } from "./payment.controller";
import { validateCreateCheckout } from "./payment.validate";

const router = Router();

router.post("/payments/checkout", optionalAuth, validateCreateCheckout, createCheckout);

export default router;
