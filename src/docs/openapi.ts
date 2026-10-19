import { z, ZodType } from "zod";
import { googleLoginSchema, loginUserSchema, registerUserSchema, requestPasswordResetSchema, resetPasswordWithOtpSchema, verifyOtpSchema } from "../module/auth/auth.type";
import { cartItemSchema, checkoutSchema as cartCheckoutSchema, couponSchema, mergeSchema } from "../module/cart/cart.route";
import { createCouponSchema, couponQuerySchema, validateCouponSchema } from "../module/coupon/coupon.validation";
import { createVersionSchema, downloadRequestSchema, uploadSignatureSchema } from "../module/download/download.validation";
import { activationSchema, upgradeSchema, verifySchema } from "../module/license/license.route";
import { checkoutSchema, legacyCheckoutSchema, stripeConfirmSchema } from "../module/payment/payment.validation";
import { createReviewSchema, reviewQuerySchema } from "../module/product-review/product-review.validation";
import {
  adminProductQuerySchema,
  importProductsSchema,
  createProductSchema,
  productQuerySchema,
  saleSchema,
  updateProductSchema,
} from "../module/product/product.validation";
import { approveSchema, rejectSchema, requestSchema } from "../module/refund/refund.route";
import { applySchema, clickSchema } from "../module/affiliate/affiliate.route";
import { createTicketSchema, replySchema } from "../module/ticket/ticket.route";
import { preferencesSchema } from "../module/notification/notification.route";
import { challengeSchema } from "../module/two-factor/two-factor.route";
import { myOrdersQuery } from "../module/order/order.route";

type Access = "public" | "user" | "admin";

interface Endpoint {
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;
  tag: string;
  summary: string;
  access: Access;
  body?: ZodType;
  query?: ZodType;
}

const endpoints: Endpoint[] = [
  // Auth
  { method: "post", path: "/auth/register", tag: "Auth", summary: "Create an account (sends an email OTP)", access: "public", body: registerUserSchema },
  { method: "post", path: "/auth/verify-otp", tag: "Auth", summary: "Verify the registration OTP", access: "public", body: verifyOtpSchema },
  { method: "post", path: "/auth/login", tag: "Auth", summary: "Sign in with email and password; returns a session token", access: "public", body: loginUserSchema },
  { method: "post", path: "/auth/google", tag: "Auth", summary: "Sign in with a Google ID token", access: "public", body: googleLoginSchema },
  { method: "post", path: "/auth/password-reset/request", tag: "Auth", summary: "Email a password reset code", access: "public", body: requestPasswordResetSchema },
  { method: "post", path: "/auth/password-reset/confirm", tag: "Auth", summary: "Reset the password with the emailed code", access: "public", body: resetPasswordWithOtpSchema },
  { method: "get", path: "/auth/me", tag: "Auth", summary: "Current user", access: "user" },

  // Catalogue
  { method: "get", path: "/products", tag: "Products", summary: "Search and filter published products", access: "public", query: productQuerySchema },
  { method: "get", path: "/products/facets", tag: "Products", summary: "Filter counts: types, categories, tech, platforms, price range", access: "public" },
  { method: "get", path: "/products/{slug}", tag: "Products", summary: "Product detail by slug or id", access: "public" },
  { method: "get", path: "/products/{slug}/related", tag: "Products", summary: "Related products", access: "public" },
  { method: "get", path: "/products/{slug}/versions", tag: "Products", summary: "Public changelog", access: "public" },
  { method: "get", path: "/products/{slug}/reviews", tag: "Reviews", summary: "Approved reviews with rating breakdown", access: "public", query: reviewQuerySchema },
  { method: "post", path: "/products/{slug}/reviews", tag: "Reviews", summary: "Review a product you bought (or a free product)", access: "user", body: createReviewSchema },
  { method: "get", path: "/tags", tag: "Products", summary: "Tags with product counts", access: "public" },
  { method: "get", path: "/template-categories", tag: "Products", summary: "Categories", access: "public" },
  { method: "get", path: "/pricing", tag: "Products", summary: "Active pricing plans (one-time and all-access)", access: "public" },

  // Wishlist & cart
  { method: "get", path: "/me/wishlist", tag: "Wishlist", summary: "Wishlist products", access: "user" },
  { method: "post", path: "/me/wishlist", tag: "Wishlist", summary: "Add to wishlist", access: "user", body: z.object({ productId: z.string().uuid() }) },
  { method: "delete", path: "/me/wishlist/{productId}", tag: "Wishlist", summary: "Remove from wishlist", access: "user" },
  { method: "get", path: "/me/cart", tag: "Cart", summary: "Cart with live prices, coupon and totals", access: "user" },
  { method: "post", path: "/me/cart/items", tag: "Cart", summary: "Add or update an item", access: "user", body: cartItemSchema },
  { method: "delete", path: "/me/cart/items/{productId}", tag: "Cart", summary: "Remove an item", access: "user" },
  { method: "post", path: "/me/cart/merge", tag: "Cart", summary: "Merge the guest cart after sign-in", access: "user", body: mergeSchema },
  { method: "post", path: "/me/cart/coupon", tag: "Cart", summary: "Apply a coupon", access: "user", body: couponSchema },
  { method: "post", path: "/me/cart/checkout", tag: "Cart", summary: "Check out the cart", access: "user", body: cartCheckoutSchema },
  { method: "post", path: "/coupons/validate", tag: "Cart", summary: "Preview a coupon on items", access: "public", body: validateCouponSchema },

  // Checkout & payments
  { method: "post", path: "/checkout", tag: "Checkout", summary: "Create an order and a Stripe / SSLCommerz payment session", access: "public", body: checkoutSchema },
  { method: "post", path: "/payments/checkout", tag: "Checkout", summary: "Legacy single-product checkout", access: "public", body: legacyCheckoutSchema },
  { method: "get", path: "/payments/orders/{id}/status", tag: "Checkout", summary: "Order status for success / failed pages", access: "public" },
  { method: "post", path: "/payments/stripe/confirm", tag: "Checkout", summary: "Confirm a Stripe session from the success page", access: "public", body: stripeConfirmSchema },
  { method: "post", path: "/webhooks/stripe", tag: "Webhooks", summary: "Stripe webhook (signed)", access: "public" },
  { method: "post", path: "/webhooks/sslcommerz", tag: "Webhooks", summary: "SSLCommerz IPN (validated with the Validation API)", access: "public" },

  // Buyer account
  { method: "get", path: "/user/orders", tag: "Account", summary: "My orders", access: "user" },
  { method: "get", path: "/me/downloads", tag: "Account", summary: "Products I can download, with latest version", access: "user" },
  { method: "get", path: "/me/orders", tag: "Account", summary: "My orders with items, licences and refund status", access: "user", query: myOrdersQuery },
  { method: "get", path: "/me/orders/{id}", tag: "Account", summary: "One of my orders (invoice view)", access: "user" },
  { method: "post", path: "/downloads/{productId}", tag: "Account", summary: "Signed download links (valid 5 minutes)", access: "user", body: downloadRequestSchema },
  { method: "get", path: "/me/licenses", tag: "Account", summary: "My licences, activations and upgrade prices", access: "user" },
  { method: "post", path: "/me/licenses/{id}/upgrade", tag: "Account", summary: "Upgrade Single → Extended for the price difference", access: "user", body: upgradeSchema },
  { method: "get", path: "/me/subscription", tag: "Account", summary: "My all-access subscription", access: "user" },
  { method: "post", path: "/me/subscription/cancel", tag: "Account", summary: "Cancel at the end of the period", access: "user" },
  { method: "post", path: "/me/subscription/portal", tag: "Account", summary: "Stripe billing portal link", access: "user" },
  { method: "post", path: "/me/orders/{id}/refund-request", tag: "Account", summary: "Request a refund", access: "user", body: requestSchema },
  { method: "get", path: "/me/reviews", tag: "Account", summary: "My reviews", access: "user" },

  // Licences (public, for buyers' software)
  { method: "post", path: "/licenses/verify", tag: "Licences", summary: "Check a licence key", access: "public", body: verifySchema },
  { method: "post", path: "/licenses/activate", tag: "Licences", summary: "Activate a licence on a domain", access: "public", body: activationSchema },
  { method: "post", path: "/licenses/deactivate", tag: "Licences", summary: "Release a domain", access: "public", body: activationSchema },

  // Affiliates
  { method: "post", path: "/affiliates/click", tag: "Affiliates", summary: "Record a ?ref= visit", access: "public", body: clickSchema },
  { method: "post", path: "/me/affiliate", tag: "Affiliates", summary: "Join the affiliate program", access: "user", body: applySchema },
  { method: "get", path: "/me/affiliate", tag: "Affiliates", summary: "Affiliate dashboard: code, clicks, conversions, balances", access: "user" },
  { method: "get", path: "/me/affiliate/referrals", tag: "Affiliates", summary: "Commissions earned", access: "user" },
  { method: "post", path: "/me/affiliate/payouts", tag: "Affiliates", summary: "Request a payout of approved commission", access: "user" },
  { method: "get", path: "/admin/affiliates", tag: "Admin", summary: "Affiliates with stats", access: "admin" },
  { method: "get", path: "/admin/affiliate-payouts", tag: "Admin", summary: "Payout requests", access: "admin" },
  { method: "post", path: "/admin/affiliate-payouts/{id}/pay", tag: "Admin", summary: "Mark a payout paid (with transfer reference)", access: "admin" },

  // Support, notifications, 2FA, personalisation
  { method: "post", path: "/me/tickets", tag: "Support", summary: "Open a support ticket", access: "user", body: createTicketSchema },
  { method: "get", path: "/me/tickets", tag: "Support", summary: "My tickets", access: "user" },
  { method: "get", path: "/tickets/{id}", tag: "Support", summary: "Ticket with messages (owner or support staff)", access: "user" },
  { method: "post", path: "/tickets/{id}/messages", tag: "Support", summary: "Reply to a ticket", access: "user", body: replySchema },
  { method: "post", path: "/tickets/{id}/close", tag: "Support", summary: "Close a ticket", access: "user" },
  { method: "get", path: "/me/notifications", tag: "Account", summary: "Notifications with unread count", access: "user" },
  { method: "post", path: "/me/notifications/read-all", tag: "Account", summary: "Mark all notifications read", access: "user" },
  { method: "get", path: "/me/preferences", tag: "Account", summary: "Preferences, role and permissions", access: "user" },
  { method: "patch", path: "/me/preferences", tag: "Account", summary: "Update email preferences", access: "user", body: preferencesSchema },
  { method: "post", path: "/me/2fa/setup", tag: "Auth", summary: "Start two-factor setup (returns otpauth URL)", access: "user" },
  { method: "post", path: "/me/2fa/enable", tag: "Auth", summary: "Turn on two-factor with a code; returns recovery codes", access: "user" },
  { method: "post", path: "/auth/2fa/verify", tag: "Auth", summary: "Second sign-in step for two-factor accounts", access: "public", body: challengeSchema },
  { method: "get", path: "/me/recently-viewed", tag: "Products", summary: "Recently viewed products", access: "user" },
  { method: "get", path: "/products/{slug}/also-bought", tag: "Products", summary: "Customers also bought", access: "public" },
  { method: "get", path: "/admin/tickets", tag: "Admin", summary: "Support queue (support staff)", access: "admin" },
  { method: "get", path: "/admin/analytics/overview", tag: "Admin", summary: "Revenue, orders, conversion, top products, MRR", access: "admin" },
  { method: "get", path: "/admin/analytics/products/{id}", tag: "Admin", summary: "Daily views, sales and revenue for a product", access: "admin" },
  { method: "get", path: "/admin/audit-logs", tag: "Admin", summary: "Audit log of staff actions", access: "admin" },

  // Admin
  { method: "get", path: "/admin/products", tag: "Admin", summary: "All products including drafts", access: "admin", query: adminProductQuerySchema },
  { method: "get", path: "/admin/products/export", tag: "Admin", summary: "Download products as CSV (same filters as the list)", access: "admin", query: adminProductQuerySchema },
  { method: "post", path: "/admin/products/import", tag: "Admin", summary: "Create or update products from CSV (dryRun to preview)", access: "admin", body: importProductsSchema },
  { method: "post", path: "/admin/products", tag: "Admin", summary: "Create a product", access: "admin", body: createProductSchema },
  { method: "patch", path: "/admin/products/{id}", tag: "Admin", summary: "Update a product", access: "admin", body: updateProductSchema },
  { method: "delete", path: "/admin/products/{id}", tag: "Admin", summary: "Delete (or archive if it has orders)", access: "admin" },
  { method: "post", path: "/admin/products/{productId}/versions", tag: "Admin", summary: "Release a version", access: "admin", body: createVersionSchema },
  { method: "post", path: "/admin/uploads/signature", tag: "Admin", summary: "Signature for direct Cloudinary uploads", access: "admin", body: uploadSignatureSchema },
  { method: "post", path: "/admin/sales", tag: "Admin", summary: "Start a flash sale", access: "admin", body: saleSchema },
  { method: "get", path: "/admin/coupons", tag: "Admin", summary: "Coupons", access: "admin", query: couponQuerySchema },
  { method: "post", path: "/admin/coupons", tag: "Admin", summary: "Create a coupon", access: "admin", body: createCouponSchema },
  { method: "get", path: "/admin/reviews", tag: "Admin", summary: "Reviews for moderation", access: "admin" },
  { method: "get", path: "/admin/subscriptions", tag: "Admin", summary: "Subscriptions", access: "admin" },
  { method: "get", path: "/admin/refund-requests", tag: "Admin", summary: "Refund requests", access: "admin" },
  { method: "post", path: "/admin/refund-requests/{id}/approve", tag: "Admin", summary: "Refund through the gateway and revoke access", access: "admin", body: approveSchema },
  { method: "post", path: "/admin/refund-requests/{id}/reject", tag: "Admin", summary: "Reject with a note to the customer", access: "admin", body: rejectSchema },
  { method: "post", path: "/orders", tag: "Admin", summary: "Record a manual sale", access: "admin" },
  { method: "get", path: "/dashboard/overview", tag: "Admin", summary: "Dashboard statistics", access: "admin" },
];

const toJsonSchema = (schema: ZodType) => {
  const { $schema, ...json } = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<string, any>;
  return json;
};

const queryParameters = (schema: ZodType) => {
  const json = toJsonSchema(schema);
  const required = new Set<string>(json.required ?? []);
  return Object.entries<Record<string, unknown>>(json.properties ?? {}).map(([name, property]) => ({
    name,
    in: "query",
    required: required.has(name),
    schema: property,
  }));
};

const pathParameters = (path: string) =>
  [...path.matchAll(/\{(\w+)\}/g)].map(([, name]) => ({ name, in: "path", required: true, schema: { type: "string" } }));

let cached: object | null = null;

export const buildOpenApiSpec = () => {
  if (cached) return cached;
  const paths: Record<string, Record<string, object>> = {};
  for (const endpoint of endpoints) {
    paths[endpoint.path] ??= {};
    paths[endpoint.path][endpoint.method] = {
      tags: [endpoint.tag],
      summary: endpoint.summary,
      ...(endpoint.access !== "public" ? { security: [{ sessionToken: [] }], description: endpoint.access === "admin" ? "Admin only" : "Signed-in users" } : {}),
      parameters: [...pathParameters(endpoint.path), ...(endpoint.query ? queryParameters(endpoint.query) : [])],
      ...(endpoint.body
        ? { requestBody: { required: true, content: { "application/json": { schema: toJsonSchema(endpoint.body) } } } }
        : {}),
      responses: {
        200: { description: "Success: `{ success: true, message, data, pagination? }`" },
        400: { description: "Validation error: `{ success: false, message, errors: [{ path, message }] }`" },
        ...(endpoint.access !== "public" ? { 401: { description: "Not signed in" }, 403: { description: "Not allowed" } } : {}),
      },
    };
  }

  cached = {
    openapi: "3.1.0",
    info: {
      title: "Themora API",
      version: "1.0.0",
      description: "Marketplace API for website templates, mobile apps, UI kits and source code. All amounts are USD unless stated.",
    },
    servers: [{ url: "/api/v1" }],
    components: {
      securitySchemes: { sessionToken: { type: "http", scheme: "bearer", description: "Session token from /auth/login" } },
    },
    paths,
  };
  return cached;
};

export const swaggerHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Themora API</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css" />
</head>
<body>
  <div id="swagger"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
  <script>SwaggerUIBundle({ url: "/api/v1/openapi.json", dom_id: "#swagger", deepLinking: true });</script>
</body>
</html>`;
