import { Request, Response, Router } from "express";
import { z } from "zod";
import { authenticateAndCheckStatus } from "../../middleware/authMiddleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { validateRequest } from "../../utils/validateRequest";
import { cartService } from "./cart.service";

const licenseType = z.enum(["SINGLE", "EXTENDED"]).default("SINGLE");
export const cartItemSchema = z.object({ productId: z.string().uuid("Invalid product ID"), licenseType });
const productParamSchema = z.object({ productId: z.string().uuid("Invalid product ID") });
export const mergeSchema = z.object({ items: z.array(cartItemSchema).max(50) });
export const couponSchema = z.object({ code: z.string().trim().min(1).max(30) });
export const checkoutSchema = z.object({ gateway: z.enum(["stripe", "sslcommerz"]), phone: z.string().trim().max(20).optional() });

const userOf = (req: Request) => (req as any).user as { id: string; email: string; fullName: string };

const router = Router();
router.use("/me/cart", authenticateAndCheckStatus);

router.get(
  "/me/cart",
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { message: "Cart fetched", data: await cartService.get(userOf(req)) });
  })
);

router.post(
  "/me/cart/items",
  validateRequest({ body: cartItemSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { productId, licenseType: type } = (req as any).validatedData;
    sendResponse(res, { message: "Added to cart", data: await cartService.addItem(userOf(req), productId, type) });
  })
);

router.patch(
  "/me/cart/items/:productId",
  validateRequest({ params: productParamSchema, body: z.object({ licenseType: z.enum(["SINGLE", "EXTENDED"]) }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const { productId } = (req as any).validatedParams;
    const cart = await cartService.addItem(userOf(req), productId, (req as any).validatedData.licenseType);
    sendResponse(res, { message: "Licence updated", data: cart });
  })
);

router.delete(
  "/me/cart/items/:productId",
  validateRequest({ params: productParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { productId } = (req as any).validatedParams;
    sendResponse(res, { message: "Removed from cart", data: await cartService.removeItem(userOf(req), productId) });
  })
);

router.delete(
  "/me/cart",
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { message: "Cart cleared", data: await cartService.clear(userOf(req)) });
  })
);

router.post(
  "/me/cart/merge",
  validateRequest({ body: mergeSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { message: "Cart merged", data: await cartService.merge(userOf(req), (req as any).validatedData.items) });
  })
);

router.post(
  "/me/cart/coupon",
  validateRequest({ body: couponSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { message: "Coupon applied", data: await cartService.applyCoupon(userOf(req), (req as any).validatedData.code) });
  })
);

router.delete(
  "/me/cart/coupon",
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { message: "Coupon removed", data: await cartService.removeCoupon(userOf(req)) });
  })
);

router.post(
  "/me/cart/checkout",
  validateRequest({ body: checkoutSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { gateway, phone } = (req as any).validatedData;
    const result = await cartService.checkout(userOf(req), gateway, phone);
    sendResponse(res, { statusCode: 201, message: "Checkout created", data: result });
  })
);

export default router;
