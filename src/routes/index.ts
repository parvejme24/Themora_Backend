import { Router } from "express";
import authRoutes from "../module/auth/auth.route";
import newsletterRoutes from "../module/newsletter/newsletter.route";
import contactRoutes from "../module/contact/contact.route";
import blogCategoryRoutes from "../module/blog-category/blog-category.route";
import blogRoutes from "../module/blog/blog.route";
import blogReviewRoutes from "../module/blog-review/blog-review.route";
import templateCategoryRoutes from "../module/template-category/template-category.route";
import templateRoutes from "../module/template/template.route";
import orderRoutes from "../module/order/order.route";
import pricingRoutes from "../module/pricing/pricing.route";
import paymentRoutes from "../module/payment/payment.route";
import webhookRoutes from "../module/webhook/webhook.route";
import dashboardRoutes from "../module/dashboard/dashboard.route";
import productRoutes from "../module/product/product.route";
import productReviewRoutes from "../module/product-review/product-review.route";
import wishlistRoutes from "../module/wishlist/wishlist.route";

const router = Router();
const apiV1Router = Router();

// Auth routes
apiV1Router.use(authRoutes);

// Newsletter routes
apiV1Router.use(newsletterRoutes);

// Contact routes
apiV1Router.use(contactRoutes);

// Blog category routes
apiV1Router.use(blogCategoryRoutes);

// Blog routes
apiV1Router.use(blogRoutes);

// Blog review routes
apiV1Router.use(blogReviewRoutes);

// Template category routes
apiV1Router.use(templateCategoryRoutes);

// Template routes (legacy, used by the current frontend)
apiV1Router.use(templateRoutes);

// Marketplace product, review and wishlist routes
apiV1Router.use(productRoutes);
apiV1Router.use(productReviewRoutes);
apiV1Router.use(wishlistRoutes);

// Order routes
apiV1Router.use(orderRoutes);

// Pricing and payment routes
apiV1Router.use(pricingRoutes);
apiV1Router.use(paymentRoutes);

// Webhook routes
apiV1Router.use(webhookRoutes);

// Dashboard overview & stats routes
apiV1Router.use(dashboardRoutes);

router.use("/api/v1", apiV1Router);

export default router;
