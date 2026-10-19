import { Router } from "express";
import {
  subscribeNewsletter,
  getAllNewsletterSubscribers,
  deleteNewsletterSubscriber,
  newsletterStats,
} from "./newsletter.controller";
import { optionalAuth } from "../../middleware/authMiddleware";
import { authorize } from "../../middleware/permissions";

const router = Router();

// Subscribe to newsletter (Public / Optional Auth)
router.post("/newsletter", optionalAuth, subscribeNewsletter);

// Get all newsletter subscribers (Admin)
router.get("/newsletter", authorize("marketing"), getAllNewsletterSubscribers);

// Get newsletter statistics (daily, weekly, monthly, yearly) (Admin)
router.get("/newsletter/stats", authorize("marketing"), newsletterStats);

// Delete newsletter subscriber by ID (Admin)
router.delete("/newsletter/:id", authorize("marketing"), deleteNewsletterSubscriber);

export default router;
