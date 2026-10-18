import { Request, Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/database";
import { authenticateAndCheckStatus } from "../../middleware/authMiddleware";
import { cacheResponse } from "../../middleware/cache";
import { authorize } from "../../middleware/permissions";
import { AppError } from "../../utils/AppError";
import { asyncHandler } from "../../utils/asyncHandler";
import { withActiveSale } from "../../utils/pricing";
import { sendResponse } from "../../utils/sendResponse";
import { validateRequest } from "../../utils/validateRequest";
import { findProductByIdOrSlug } from "../product/product.service";
import { analyticsService } from "./analytics.service";

const rangeSchema = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });
const auditQuerySchema = z.object({
  actorId: z.string().uuid().optional(),
  entityType: z.string().trim().max(50).optional(),
  entityId: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const router = Router();

router.get(
  "/admin/analytics/overview",
  authorize("analytics"),
  validateRequest({ query: rangeSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { message: "Analytics overview", data: await analyticsService.overview((req as any).validatedQuery.days) });
  })
);

router.get(
  "/admin/analytics/products/:id",
  authorize("analytics"),
  validateRequest({ params: z.object({ id: z.string().uuid() }), query: rangeSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { message: "Product analytics", data: await analyticsService.product(req.params.id, (req as any).validatedQuery.days) });
  })
);

router.get(
  "/admin/audit-logs",
  authorize("audit"),
  validateRequest({ query: auditQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { actorId, entityType, entityId, page, limit } = (req as any).validatedQuery;
    const where = { ...(actorId ? { actorId } : {}), ...(entityType ? { entityType } : {}), ...(entityId ? { entityId } : {}) };
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { actor: { select: { id: true, fullName: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);
    sendResponse(res, {
      message: "Audit log fetched",
      data: logs,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), hasNext: page * limit < total, hasPrev: page > 1 },
    });
  })
);

router.get(
  "/me/recently-viewed",
  authenticateAndCheckStatus,
  asyncHandler(async (req: Request, res: Response) => {
    const products = await analyticsService.recentlyViewed((req as any).user.id);
    sendResponse(res, { message: "Recently viewed products", data: products.map(withActiveSale) });
  })
);

router.get(
  "/products/:slug/also-bought",
  cacheResponse(300),
  asyncHandler(async (req: Request, res: Response) => {
    const product = await prisma.template.findFirst({
      where: { ...findProductByIdOrSlug(req.params.slug), status: "PUBLISHED" },
      select: { id: true },
    });
    if (!product) throw AppError.notFound("Product not found");
    const products = await analyticsService.alsoBought(product.id);
    sendResponse(res, { message: "Customers also bought", data: products.map(withActiveSale) });
  })
);

export default router;
