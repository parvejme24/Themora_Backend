"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../../middleware/authMiddleware");
const payment_controller_1 = require("./payment.controller");
const payment_validate_1 = require("./payment.validate");
const router = (0, express_1.Router)();
router.post("/payments/checkout", authMiddleware_1.optionalAuth, payment_validate_1.validateCreateCheckout, payment_controller_1.createCheckout);
exports.default = router;
//# sourceMappingURL=payment.route.js.map