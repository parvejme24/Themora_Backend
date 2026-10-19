import { Router } from "express";
import {
  createBlogReview,
  createBlogReviewReply,
  getReviewsByBlogId,
  getBlogReviewById,
  updateBlogReview,
  hideBlogReview,
  unhideBlogReview,
  deleteBlogReview,
  deleteAllReviewsByBlogId,
  deleteBlogReviewReply,
} from "./blog-review.controller";
import {
  validateCreateBlogReview,
  validateCreateBlogReviewReply,
  validateUpdateBlogReview,
  validateBlogReviewId,
  validateBlogIdParam,
  validateBlogReviewReplyId,
} from "./blog-review.validate";
import { authenticateAndCheckStatus, optionalAuth } from "../../middleware/authMiddleware";
import { authorize } from "../../middleware/permissions";

const router = Router();

// Public routes (with optional auth to filter hidden reviews)
router.get("/blog-reviews/:blogId", optionalAuth, validateBlogIdParam, getReviewsByBlogId);
router.get("/blog-reviews/review/:reviewId", optionalAuth, validateBlogReviewId, getBlogReviewById);

// User routes (authentication required)
router.post("/blog-reviews/:blogId", authenticateAndCheckStatus, validateBlogIdParam, validateCreateBlogReview, createBlogReview);
router.put("/blog-reviews/:reviewId", authenticateAndCheckStatus, validateBlogReviewId, validateUpdateBlogReview, updateBlogReview);
router.delete("/blog-reviews/:reviewId", authenticateAndCheckStatus, validateBlogReviewId, deleteBlogReview);

// Admin routes
router.post("/blog-reviews/reply/:reviewId", authorize("reviews:moderate"), validateBlogReviewId, validateCreateBlogReviewReply, createBlogReviewReply);
router.patch("/blog-reviews/:reviewId/hide", authorize("reviews:moderate"), validateBlogReviewId, hideBlogReview);
router.patch("/blog-reviews/:reviewId/unhide", authorize("reviews:moderate"), validateBlogReviewId, unhideBlogReview);
router.delete("/blog-reviews/blog/:blogId/all", authorize("reviews:moderate"), validateBlogIdParam, deleteAllReviewsByBlogId);
router.delete("/blog-reviews/reply/:replyId", authorize("reviews:moderate"), validateBlogReviewReplyId, deleteBlogReviewReply);

export default router;

