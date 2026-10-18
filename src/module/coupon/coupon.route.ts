import { Request, Response, Router } from "express";
import { authenticateAdminAndCheckStatus, optionalAuth } from "../../middleware/authMiddleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { validateRequest } from "../../utils/validateRequest";
import { checkoutService } from "../payment/checkout.service";
import { couponService } from "./coupon.service";
import {
  couponIdParamSchema,
  couponQuerySchema,
  createCouponSchema,
  updateCouponSchema,
  validateCouponSchema,
} from "./coupon.validation";

const router = Router();

// Preview a coupon on a set of items before checkout (guests pass an email)
router.post(
  "/coupons/validate",
  optionalAuth,
  validateRequest({ body: validateCouponSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { code, items, email } = (req as any).validatedData;
    const user = (req as any).user;
    const quote = await checkoutService.quote(items, code, { userId: user?.id, email: user?.email ?? email });
    sendResponse(res, {
      message: "Coupon applied",
      data: {
        code: quote.coupon?.code,
        description: quote.coupon?.description ?? null,
        subtotal: quote.subtotal,
        discountTotal: quote.discountTotal,
        totalAmount: quote.totalAmount,
        items: quote.items.map(({ categoryId, billingInterval, ...item }) => item),
      },
    });
  })
);

router.get(
  "/admin/coupons",
  authenticateAdminAndCheckStatus,
  validateRequest({ query: couponQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { coupons, pagination } = await couponService.list((req as any).validatedQuery);
    sendResponse(res, { message: "Coupons fetched", data: coupons, pagination });
  })
);

router.get(
  "/admin/coupons/:id",
  authenticateAdminAndCheckStatus,
  validateRequest({ params: couponIdParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { message: "Coupon fetched", data: await couponService.get(req.params.id) });
  })
);

router.post(
  "/admin/coupons",
  authenticateAdminAndCheckStatus,
  validateRequest({ body: createCouponSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const coupon = await couponService.create((req as any).validatedData);
    sendResponse(res, { statusCode: 201, message: "Coupon created", data: coupon });
  })
);

router.patch(
  "/admin/coupons/:id",
  authenticateAdminAndCheckStatus,
  validateRequest({ params: couponIdParamSchema, body: updateCouponSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const coupon = await couponService.update(req.params.id, (req as any).validatedData);
    sendResponse(res, { message: "Coupon updated", data: coupon });
  })
);

router.delete(
  "/admin/coupons/:id",
  authenticateAdminAndCheckStatus,
  validateRequest({ params: couponIdParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { deactivated } = await couponService.remove(req.params.id);
    sendResponse(res, {
      message: deactivated ? "Coupon has been used, so it was deactivated instead of deleted" : "Coupon deleted",
      data: { deactivated },
    });
  })
);

export default router;
