import { Request, Response } from "express";
import { clearCache } from "../../middleware/cache";
import { asyncHandler } from "../../utils/asyncHandler";
import { runInBackground } from "../../utils/background";
import { sendResponse } from "../../utils/sendResponse";
import { productService } from "./product.service";
import { analyticsService } from "../analytics/analytics.service";

const clearProductCaches = () => {
  clearCache("/api/v1/products");
  clearCache("/api/v1/templates");
  clearCache("/api/v1/tags");
};

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const { items, pagination } = await productService.list((req as any).validatedQuery);
  sendResponse(res, { message: "Products fetched successfully", data: items, pagination });
});

export const getProductFacets = asyncHandler(async (_req: Request, res: Response) => {
  const facets = await productService.facets();
  sendResponse(res, { message: "Product facets fetched successfully", data: facets });
});

export const listTags = asyncHandler(async (_req: Request, res: Response) => {
  const tags = await productService.listTags();
  sendResponse(res, { message: "Tags fetched successfully", data: tags });
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.getPublic(req.params.slug);
  const userId = (req as any).user?.id as string | undefined;
  runInBackground("record product view", () =>
    Promise.all([
      productService.recordView(product.id),
      analyticsService.recordView(product.id),
      userId ? analyticsService.rememberView(userId, product.id) : null,
    ])
  );
  sendResponse(res, { message: "Product fetched successfully", data: product });
});

export const getRelatedProducts = asyncHandler(async (req: Request, res: Response) => {
  const products = await productService.related(req.params.slug, (req as any).validatedQuery.limit);
  sendResponse(res, { message: "Related products fetched successfully", data: products });
});

export const adminListProducts = asyncHandler(async (req: Request, res: Response) => {
  const { items, pagination } = await productService.list((req as any).validatedQuery, { publicOnly: false });
  sendResponse(res, { message: "Products fetched successfully", data: items, pagination });
});

export const adminGetProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.getForAdmin(req.params.id);
  sendResponse(res, { message: "Product fetched successfully", data: product });
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.create((req as any).validatedData);
  clearProductCaches();
  sendResponse(res, { statusCode: 201, message: "Product created successfully", data: product });
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.update(req.params.id, (req as any).validatedData);
  clearProductCaches();
  sendResponse(res, { message: "Product updated successfully", data: product });
});

export const startSale = asyncHandler(async (req: Request, res: Response) => {
  const result = await productService.startSale((req as any).validatedData);
  clearProductCaches();
  sendResponse(res, { message: `Sale started on ${result.updated} products`, data: result });
});

export const endSale = asyncHandler(async (req: Request, res: Response) => {
  const result = await productService.endSale((req as any).validatedData);
  clearProductCaches();
  sendResponse(res, { message: `Sale ended on ${result.updated} products`, data: result });
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const { archived } = await productService.remove(req.params.id);
  clearProductCaches();
  sendResponse(res, {
    message: archived
      ? "Product has purchase history, so it was archived instead of deleted"
      : "Product deleted successfully",
    data: { archived },
  });
});
