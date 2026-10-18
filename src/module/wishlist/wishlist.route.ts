import { Request, Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/database";
import { authenticateAndCheckStatus } from "../../middleware/authMiddleware";
import { AppError } from "../../utils/AppError";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { validateRequest } from "../../utils/validateRequest";
import { productCardSelect } from "../product/product.service";
import { withActiveSale } from "../../utils/pricing";

const productIdSchema = z.object({ productId: z.string().uuid("Invalid product ID") });

const userIdOf = (req: Request) => (req as any).user.id as string;

const listWishlist = asyncHandler(async (req: Request, res: Response) => {
  const items = await prisma.wishlistItem.findMany({
    where: { userId: userIdOf(req), product: { status: "PUBLISHED" } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, product: { select: productCardSelect } },
  });
  sendResponse(res, {
    message: "Wishlist fetched successfully",
    data: items.map((item) => ({ ...withActiveSale(item.product), addedAt: item.createdAt })),
  });
});

// Lightweight list of product IDs, for heart icons on product cards
const listWishlistIds = asyncHandler(async (req: Request, res: Response) => {
  const items = await prisma.wishlistItem.findMany({ where: { userId: userIdOf(req) }, select: { productId: true } });
  sendResponse(res, { message: "Wishlist IDs fetched successfully", data: items.map((item) => item.productId) });
});

const addToWishlist = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = (req as any).validatedData;
  const product = await prisma.template.findFirst({ where: { id: productId, status: "PUBLISHED" }, select: { id: true } });
  if (!product) throw AppError.notFound("Product not found");

  await prisma.wishlistItem.upsert({
    where: { userId_productId: { userId: userIdOf(req), productId } },
    create: { userId: userIdOf(req), productId },
    update: {},
  });
  sendResponse(res, { statusCode: 201, message: "Added to wishlist", data: { productId } });
});

const removeFromWishlist = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = (req as any).validatedParams;
  await prisma.wishlistItem.deleteMany({ where: { userId: userIdOf(req), productId } });
  sendResponse(res, { message: "Removed from wishlist", data: { productId } });
});

const router = Router();

router.get("/me/wishlist", authenticateAndCheckStatus, listWishlist);
router.get("/me/wishlist/ids", authenticateAndCheckStatus, listWishlistIds);
router.post("/me/wishlist", authenticateAndCheckStatus, validateRequest({ body: productIdSchema }), addToWishlist);
router.delete(
  "/me/wishlist/:productId",
  authenticateAndCheckStatus,
  validateRequest({ params: productIdSchema }),
  removeFromWishlist
);

export default router;
