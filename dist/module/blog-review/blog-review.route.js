"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const blog_review_controller_1 = require("./blog-review.controller");
const blog_review_validate_1 = require("./blog-review.validate");
const authMiddleware_1 = require("../../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.get("/blog-reviews/:blogId", authMiddleware_1.optionalAuth, blog_review_validate_1.validateBlogIdParam, blog_review_controller_1.getReviewsByBlogId);
router.get("/blog-reviews/review/:reviewId", authMiddleware_1.optionalAuth, blog_review_validate_1.validateBlogReviewId, blog_review_controller_1.getBlogReviewById);
router.post("/blog-reviews/:blogId", authMiddleware_1.authenticateAndCheckStatus, blog_review_validate_1.validateBlogIdParam, blog_review_validate_1.validateCreateBlogReview, blog_review_controller_1.createBlogReview);
router.put("/blog-reviews/:reviewId", authMiddleware_1.authenticateAndCheckStatus, blog_review_validate_1.validateBlogReviewId, blog_review_validate_1.validateUpdateBlogReview, blog_review_controller_1.updateBlogReview);
router.delete("/blog-reviews/:reviewId", authMiddleware_1.authenticateAndCheckStatus, blog_review_validate_1.validateBlogReviewId, blog_review_controller_1.deleteBlogReview);
router.post("/blog-reviews/reply/:reviewId", authMiddleware_1.authenticateAdminAndCheckStatus, blog_review_validate_1.validateBlogReviewId, blog_review_validate_1.validateCreateBlogReviewReply, blog_review_controller_1.createBlogReviewReply);
router.patch("/blog-reviews/:reviewId/hide", authMiddleware_1.authenticateAdminAndCheckStatus, blog_review_validate_1.validateBlogReviewId, blog_review_controller_1.hideBlogReview);
router.patch("/blog-reviews/:reviewId/unhide", authMiddleware_1.authenticateAdminAndCheckStatus, blog_review_validate_1.validateBlogReviewId, blog_review_controller_1.unhideBlogReview);
router.delete("/blog-reviews/blog/:blogId/all", authMiddleware_1.authenticateAdminAndCheckStatus, blog_review_validate_1.validateBlogIdParam, blog_review_controller_1.deleteAllReviewsByBlogId);
router.delete("/blog-reviews/reply/:replyId", authMiddleware_1.authenticateAdminAndCheckStatus, blog_review_validate_1.validateBlogReviewReplyId, blog_review_controller_1.deleteBlogReviewReply);
exports.default = router;
//# sourceMappingURL=blog-review.route.js.map