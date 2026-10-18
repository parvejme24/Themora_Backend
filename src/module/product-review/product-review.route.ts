import { Router } from "express";
import { authenticateAndCheckStatus } from "../../middleware/authMiddleware";
import { authorize } from "../../middleware/permissions";
import { validateRequest } from "../../utils/validateRequest";
import {
  adminListReviews,
  createProductReview,
  deleteProductReview,
  deleteReviewReply,
  listMyReviews,
  listProductReviews,
  replyToReview,
  setReviewStatus,
  updateProductReview,
} from "./product-review.controller";
import {
  adminReviewQuerySchema,
  createReviewSchema,
  productParamSchema,
  replySchema,
  reviewIdParamSchema,
  reviewQuerySchema,
  reviewStatusSchema,
  updateReviewSchema,
} from "./product-review.validation";

const router = Router();

router.get(
  "/products/:slug/reviews",
  validateRequest({ params: productParamSchema, query: reviewQuerySchema }),
  listProductReviews
);
router.post(
  "/products/:slug/reviews",
  authenticateAndCheckStatus,
  validateRequest({ params: productParamSchema, body: createReviewSchema }),
  createProductReview
);
router.get("/me/reviews", authenticateAndCheckStatus, listMyReviews);
router.patch(
  "/reviews/:id",
  authenticateAndCheckStatus,
  validateRequest({ params: reviewIdParamSchema, body: updateReviewSchema }),
  updateProductReview
);
router.delete("/reviews/:id", authenticateAndCheckStatus, validateRequest({ params: reviewIdParamSchema }), deleteProductReview);
router.post(
  "/reviews/:id/replies",
  authenticateAndCheckStatus,
  validateRequest({ params: reviewIdParamSchema, body: replySchema }),
  replyToReview
);
router.delete("/review-replies/:id", authenticateAndCheckStatus, validateRequest({ params: reviewIdParamSchema }), deleteReviewReply);

// Admin moderation
router.get("/admin/reviews", authorize("reviews:moderate"), validateRequest({ query: adminReviewQuerySchema }), adminListReviews);
router.patch(
  "/admin/reviews/:id/status",
  authorize("reviews:moderate"),
  validateRequest({ params: reviewIdParamSchema, body: reviewStatusSchema }),
  setReviewStatus
);

export default router;
