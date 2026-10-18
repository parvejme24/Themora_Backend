import { Request, Response, Router } from "express";
import { z } from "zod";
import { authenticateAdminAndCheckStatus, authenticateAndCheckStatus } from "../../middleware/authMiddleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { validateRequest } from "../../utils/validateRequest";
import { subscriptionService } from "./subscription.service";

const userIdOf = (req: Request) => (req as any).user.id as string;

const adminQuerySchema = z.object({
  status: z.enum(["ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const router = Router();

router.get(
  "/me/subscription",
  authenticateAndCheckStatus,
  asyncHandler(async (req: Request, res: Response) => {
    const subscription = await subscriptionService.getForUser(userIdOf(req));
    sendResponse(res, { message: "Subscription fetched", data: subscription });
  })
);

router.post(
  "/me/subscription/cancel",
  authenticateAndCheckStatus,
  asyncHandler(async (req: Request, res: Response) => {
    const subscription = await subscriptionService.cancel(userIdOf(req));
    sendResponse(res, { message: "Your subscription will end at the close of the current period", data: subscription });
  })
);

router.post(
  "/me/subscription/resume",
  authenticateAndCheckStatus,
  asyncHandler(async (req: Request, res: Response) => {
    const subscription = await subscriptionService.resume(userIdOf(req));
    sendResponse(res, { message: "Your subscription will renew automatically", data: subscription });
  })
);

router.post(
  "/me/subscription/portal",
  authenticateAndCheckStatus,
  asyncHandler(async (req: Request, res: Response) => {
    const url = await subscriptionService.billingPortal(userIdOf(req));
    sendResponse(res, { message: "Billing portal ready", data: { url } });
  })
);

router.get(
  "/admin/subscriptions",
  authenticateAdminAndCheckStatus,
  validateRequest({ query: adminQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { subscriptions, pagination } = await subscriptionService.adminList((req as any).validatedQuery);
    sendResponse(res, { message: "Subscriptions fetched", data: subscriptions, pagination });
  })
);

export default router;
