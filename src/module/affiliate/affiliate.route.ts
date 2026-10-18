import { Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authenticateAndCheckStatus } from "../../middleware/authMiddleware";
import { authorize } from "../../middleware/permissions";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { validateRequest } from "../../utils/validateRequest";
import { affiliateService } from "./affiliate.service";

const payoutMethod = z.enum(["bkash", "nagad", "bank_transfer", "paypal"]);

export const applySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{4,20}$/, "Codes are 4–20 letters or numbers")
    .optional(),
  payoutMethod,
  payoutDetails: z.string().trim().min(5, "Add the account number or email we should pay").max(300),
  website: z.string().trim().url().optional(),
});
const updateSchema = applySchema.omit({ code: true }).partial();
export const clickSchema = z.object({
  code: z.string().trim().min(1).max(30),
  landingPath: z.string().trim().max(300).optional(),
  referrer: z.string().trim().max(300).optional(),
});
const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const adminListSchema = pageSchema.extend({ status: z.enum(["PENDING", "ACTIVE", "SUSPENDED"]).optional() });
const adminPayoutListSchema = pageSchema.extend({ status: z.enum(["REQUESTED", "PAID", "REJECTED"]).optional() });
const adminUpdateSchema = z
  .object({ status: z.enum(["PENDING", "ACTIVE", "SUSPENDED"]).optional(), commissionRate: z.number().min(0).max(0.9).optional() })
  .refine((data) => Object.keys(data).length > 0, "Nothing to update");
const idParamSchema = z.object({ id: z.string().uuid() });

const clickLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  skip: () => process.env.NODE_ENV === "test",
  standardHeaders: true,
  legacyHeaders: false,
});

const userOf = (req: Request) => (req as any).user as { id: string; fullName: string };

const router = Router();

// Public: the frontend reports ?ref= visits
router.post(
  "/affiliates/click",
  clickLimiter,
  validateRequest({ body: clickSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { code, landingPath, referrer } = (req as any).validatedData;
    const result = await affiliateService.recordClick(code, {
      ip: req.ip ?? "",
      userAgent: String(req.headers["user-agent"] ?? ""),
      landingPath,
      referrer,
    });
    sendResponse(res, { message: result.valid ? "Referral recorded" : "Unknown referral code", data: result });
  })
);

// Affiliate account
router.post(
  "/me/affiliate",
  authenticateAndCheckStatus,
  validateRequest({ body: applySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const affiliate = await affiliateService.apply(userOf(req), (req as any).validatedData);
    sendResponse(res, {
      statusCode: 201,
      message: affiliate.status === "ACTIVE" ? "Welcome to the affiliate program" : "Application received; we'll review it shortly",
      data: affiliate,
    });
  })
);

router.get(
  "/me/affiliate",
  authenticateAndCheckStatus,
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { message: "Affiliate dashboard", data: await affiliateService.dashboard(userOf(req).id) });
  })
);

router.patch(
  "/me/affiliate",
  authenticateAndCheckStatus,
  validateRequest({ body: updateSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { message: "Affiliate details updated", data: await affiliateService.updateMine(userOf(req).id, (req as any).validatedData) });
  })
);

router.get(
  "/me/affiliate/referrals",
  authenticateAndCheckStatus,
  validateRequest({ query: pageSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = (req as any).validatedQuery;
    const { referrals, pagination } = await affiliateService.referrals(userOf(req).id, page, limit);
    sendResponse(res, { message: "Referrals fetched", data: referrals, pagination });
  })
);

router.get(
  "/me/affiliate/payouts",
  authenticateAndCheckStatus,
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { message: "Payouts fetched", data: await affiliateService.payouts(userOf(req).id) });
  })
);

router.post(
  "/me/affiliate/payouts",
  authenticateAndCheckStatus,
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { statusCode: 201, message: "Payout requested", data: await affiliateService.requestPayout(userOf(req).id) });
  })
);

// Admin
router.get(
  "/admin/affiliates",
  authorize("marketing"),
  validateRequest({ query: adminListSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { affiliates, pagination } = await affiliateService.adminList((req as any).validatedQuery);
    sendResponse(res, { message: "Affiliates fetched", data: affiliates, pagination });
  })
);

router.patch(
  "/admin/affiliates/:id",
  authorize("marketing"),
  validateRequest({ params: idParamSchema, body: adminUpdateSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { message: "Affiliate updated", data: await affiliateService.adminUpdate(req.params.id, (req as any).validatedData) });
  })
);

router.get(
  "/admin/affiliate-payouts",
  authorize("marketing"),
  validateRequest({ query: adminPayoutListSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { payouts, pagination } = await affiliateService.adminPayouts((req as any).validatedQuery);
    sendResponse(res, { message: "Payouts fetched", data: payouts, pagination });
  })
);

router.post(
  "/admin/affiliate-payouts/:id/pay",
  authorize("marketing"),
  validateRequest({ params: idParamSchema, body: z.object({ reference: z.string().trim().min(3).max(200) }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const payout = await affiliateService.markPayoutPaid(req.params.id, (req as any).validatedData.reference);
    sendResponse(res, { message: "Payout marked as paid", data: payout });
  })
);

router.post(
  "/admin/affiliate-payouts/:id/reject",
  authorize("marketing"),
  validateRequest({ params: idParamSchema, body: z.object({ note: z.string().trim().min(5).max(500) }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const payout = await affiliateService.rejectPayout(req.params.id, (req as any).validatedData.note);
    sendResponse(res, { message: "Payout rejected", data: payout });
  })
);

export default router;
