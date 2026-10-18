import { Request, Response, Router } from "express";
import { z } from "zod";
import { authenticateAdminAndCheckStatus, authenticateAndCheckStatus } from "../../middleware/authMiddleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { validateRequest } from "../../utils/validateRequest";
import { refundService } from "./refund.service";

const idParamSchema = z.object({ id: z.string().uuid() });
const requestSchema = z.object({ reason: z.string().trim().min(10, "Please tell us a little more (at least 10 characters)").max(2000) });
const approveSchema = z.object({ note: z.string().trim().max(1000).optional() });
const rejectSchema = z.object({ note: z.string().trim().min(5, "Explain the decision to the customer").max(1000) });
const adminQuerySchema = z.object({
  status: z.enum(["REQUESTED", "REFUNDED", "REJECTED", "FAILED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const userOf = (req: Request) => (req as any).user as { id: string; email: string };

const router = Router();

router.post(
  "/me/orders/:id/refund-request",
  authenticateAndCheckStatus,
  validateRequest({ params: idParamSchema, body: requestSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const request = await refundService.request(userOf(req), req.params.id, (req as any).validatedData.reason);
    sendResponse(res, { statusCode: 201, message: "Refund request submitted", data: request });
  })
);

router.get(
  "/me/refund-requests",
  authenticateAndCheckStatus,
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { message: "Refund requests fetched", data: await refundService.listMine(userOf(req).id) });
  })
);

router.get(
  "/admin/refund-requests",
  authenticateAdminAndCheckStatus,
  validateRequest({ query: adminQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { requests, pagination } = await refundService.adminList((req as any).validatedQuery);
    sendResponse(res, { message: "Refund requests fetched", data: requests, pagination });
  })
);

router.post(
  "/admin/refund-requests/:id/approve",
  authenticateAdminAndCheckStatus,
  validateRequest({ params: idParamSchema, body: approveSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const request = await refundService.approve(req.params.id, userOf(req).id, (req as any).validatedData.note);
    sendResponse(res, { message: "Refund issued", data: request });
  })
);

router.post(
  "/admin/refund-requests/:id/reject",
  authenticateAdminAndCheckStatus,
  validateRequest({ params: idParamSchema, body: rejectSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const request = await refundService.reject(req.params.id, userOf(req).id, (req as any).validatedData.note);
    sendResponse(res, { message: "Refund request rejected", data: request });
  })
);

export default router;
