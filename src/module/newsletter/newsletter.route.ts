import { Router } from "express";
import {
  subscribeNewsletter,
  getAllNewsletterSubscribers,
  deleteNewsletterSubscriber,
  newsletterStats,
} from "./newsletter.controller";
import {
  authenticateAdminAndCheckStatus,
  optionalAuth,
} from "../../middleware/authMiddleware";

const router = Router();

// Subscribe to newsletter (Public / Optional Auth)
router.post("/newsletter", optionalAuth, subscribeNewsletter);

// Get all newsletter subscribers (Admin)
router.get("/newsletter", authenticateAdminAndCheckStatus, getAllNewsletterSubscribers);

// Get newsletter statistics (daily, weekly, monthly, yearly) (Admin)
router.get("/newsletter/stats", authenticateAdminAndCheckStatus, newsletterStats);

// Delete newsletter subscriber by ID (Admin)
router.delete("/newsletter/:id", authenticateAdminAndCheckStatus, deleteNewsletterSubscriber);

export default router;
