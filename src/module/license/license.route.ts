import { Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authenticateAndCheckStatus } from "../../middleware/authMiddleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { validateRequest } from "../../utils/validateRequest";
import { checkoutService } from "../payment/checkout.service";
import { licenseService } from "./license.service";

const licenseKey = z.string().trim().min(8).max(64);
const verifySchema = z.object({ licenseKey, domain: z.string().trim().max(253).optional() });
const activationSchema = z.object({ licenseKey, domain: z.string().trim().min(1).max(253) });
const idParamSchema = z.object({ id: z.string().uuid() });
const activationParamSchema = z.object({ id: z.string().uuid(), activationId: z.string().uuid() });
const upgradeSchema = z.object({ gateway: z.enum(["stripe", "sslcommerz"]), phone: z.string().trim().max(20).optional() });

// Public licence endpoints are called by buyers' software; limit guessing
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  skip: () => process.env.NODE_ENV === "test",
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many licence requests. Please wait a minute" },
});

const userOf = (req: Request) => (req as any).user as { id: string; email: string; fullName: string };

const router = Router();

router.post(
  "/licenses/verify",
  publicLimiter,
  validateRequest({ body: verifySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { licenseKey: key, domain } = (req as any).validatedData;
    sendResponse(res, { message: "Licence checked", data: await licenseService.verify(key, domain) });
  })
);

router.post(
  "/licenses/activate",
  publicLimiter,
  validateRequest({ body: activationSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { licenseKey: key, domain } = (req as any).validatedData;
    sendResponse(res, { message: "Licence activated", data: await licenseService.activate(key, domain) });
  })
);

router.post(
  "/licenses/deactivate",
  publicLimiter,
  validateRequest({ body: activationSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { licenseKey: key, domain } = (req as any).validatedData;
    sendResponse(res, { message: "Licence deactivated", data: await licenseService.deactivate(key, domain) });
  })
);

router.get(
  "/me/licenses",
  authenticateAndCheckStatus,
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { message: "Licences fetched", data: await licenseService.listMine(userOf(req).id) });
  })
);

router.delete(
  "/me/licenses/:id/activations/:activationId",
  authenticateAndCheckStatus,
  validateRequest({ params: activationParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    await licenseService.removeActivation(userOf(req).id, req.params.id, req.params.activationId);
    sendResponse(res, { message: "Activation removed" });
  })
);

router.post(
  "/me/licenses/:id/upgrade",
  authenticateAndCheckStatus,
  validateRequest({ params: idParamSchema, body: upgradeSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { gateway, phone } = (req as any).validatedData;
    const result = await checkoutService.createUpgradeCheckout(userOf(req), req.params.id, gateway, phone);
    sendResponse(res, { statusCode: 201, message: "Upgrade checkout created", data: result });
  })
);

export default router;
