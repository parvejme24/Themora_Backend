import { Router } from "express";
import { authorize } from "../../middleware/permissions";
import { optionalAuth } from "../../middleware/authMiddleware";
import { cacheResponse } from "../../middleware/cache";
import { validateRequest } from "../../utils/validateRequest";
import {
  adminGetProduct,
  adminListProducts,
  createProduct,
  deleteProduct,
  endSale,
  startSale,
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
  endSaleSchema,
  saleSchema,
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
router.get("/products/:slug", optionalAuth, validateRequest({ params: productSlugParamSchema }), getProduct);
router.get(
  "/products/:slug/related",
  cacheResponse(60),
  validateRequest({ params: productSlugParamSchema, query: relatedQuerySchema }),
  getRelatedProducts
);

// Admin
router.get("/admin/products", authorize("catalog:write"), validateRequest({ query: adminProductQuerySchema }), adminListProducts);
router.get("/admin/products/:id", authorize("catalog:write"), validateRequest({ params: productIdParamSchema }), adminGetProduct);
router.post("/admin/products", authorize("catalog:write"), validateRequest({ body: createProductSchema }), createProduct);
router.patch(
  "/admin/products/:id",
  authorize("catalog:write"),
  validateRequest({ params: productIdParamSchema, body: updateProductSchema }),
  updateProduct
);
router.delete("/admin/products/:id", authorize("catalog:write"), validateRequest({ params: productIdParamSchema }), deleteProduct);

router.post("/admin/sales", authorize("catalog:write"), validateRequest({ body: saleSchema }), startSale);
router.delete("/admin/sales", authorize("catalog:write"), validateRequest({ body: endSaleSchema }), endSale);

export default router;
