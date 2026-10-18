import { Router } from "express";
import { authenticateAdminAndCheckStatus } from "../../middleware/authMiddleware";
import { cacheResponse } from "../../middleware/cache";
import { validateRequest } from "../../utils/validateRequest";
import {
  adminGetProduct,
  adminListProducts,
  createProduct,
  deleteProduct,
  getProduct,
  getProductFacets,
  getRelatedProducts,
  listProducts,
  listTags,
  updateProduct,
} from "./product.controller";
import {
  adminProductQuerySchema,
  createProductSchema,
  productIdParamSchema,
  productQuerySchema,
  productSlugParamSchema,
  relatedQuerySchema,
  updateProductSchema,
} from "./product.validation";

const router = Router();

// Public storefront
router.get("/products", cacheResponse(30), validateRequest({ query: productQuerySchema }), listProducts);
router.get("/products/facets", cacheResponse(60), getProductFacets);
router.get("/tags", cacheResponse(60), listTags);
router.get("/products/:slug", validateRequest({ params: productSlugParamSchema }), getProduct);
router.get(
  "/products/:slug/related",
  cacheResponse(60),
  validateRequest({ params: productSlugParamSchema, query: relatedQuerySchema }),
  getRelatedProducts
);

// Admin
router.get("/admin/products", authenticateAdminAndCheckStatus, validateRequest({ query: adminProductQuerySchema }), adminListProducts);
router.get("/admin/products/:id", authenticateAdminAndCheckStatus, validateRequest({ params: productIdParamSchema }), adminGetProduct);
router.post("/admin/products", authenticateAdminAndCheckStatus, validateRequest({ body: createProductSchema }), createProduct);
router.patch(
  "/admin/products/:id",
  authenticateAdminAndCheckStatus,
  validateRequest({ params: productIdParamSchema, body: updateProductSchema }),
  updateProduct
);
router.delete("/admin/products/:id", authenticateAdminAndCheckStatus, validateRequest({ params: productIdParamSchema }), deleteProduct);

export default router;
