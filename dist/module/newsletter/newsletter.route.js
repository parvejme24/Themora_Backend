"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const newsletter_controller_1 = require("./newsletter.controller");
const authMiddleware_1 = require("../../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.post("/newsletter", authMiddleware_1.optionalAuth, newsletter_controller_1.subscribeNewsletter);
router.get("/newsletter", authMiddleware_1.authenticateAdminAndCheckStatus, newsletter_controller_1.getAllNewsletterSubscribers);
router.get("/newsletter/stats", authMiddleware_1.authenticateAdminAndCheckStatus, newsletter_controller_1.newsletterStats);
router.delete("/newsletter/:id", authMiddleware_1.authenticateAdminAndCheckStatus, newsletter_controller_1.deleteNewsletterSubscriber);
exports.default = router;
//# sourceMappingURL=newsletter.route.js.map