import { Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authenticateAndCheckStatus } from "../../middleware/authMiddleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { validateRequest } from "../../utils/validateRequest";
import { twoFactorService } from "./two-factor.service";

const code = z.string().trim().min(6).max(20);
export const challengeSchema = z.object({ challengeToken: z.string().min(20), code, clientToken: z.string().min(10).optional() });
const disableSchema = z.object({ code: code.optional(), password: z.string().min(1).optional() }).refine((data) => data.code || data.password, "Enter a code or your password");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skip: () => process.env.NODE_ENV === "test",
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Please wait 15 minutes and try again" },
});

const userIdOf = (req: Request) => (req as any).user.id as string;

const router = Router();

// Second sign-in step after /auth/login returns { twoFactorRequired, challengeToken }
router.post(
  "/auth/2fa/verify",
  limiter,
  validateRequest({ body: challengeSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { challengeToken, code: value, clientToken } = (req as any).validatedData;
    sendResponse(res, { message: "Login successful", data: await twoFactorService.completeChallenge(challengeToken, value, clientToken) });
  })
);

router.post(
  "/me/2fa/setup",
  authenticateAndCheckStatus,
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { message: "Scan the QR code with your authenticator app", data: await twoFactorService.setup(userIdOf(req)) });
  })
);

router.post(
  "/me/2fa/enable",
  limiter,
  authenticateAndCheckStatus,
  validateRequest({ body: z.object({ code }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await twoFactorService.enable(userIdOf(req), (req as any).validatedData.code);
    sendResponse(res, { message: "Two-factor authentication is on. Save your recovery codes somewhere safe", data: result });
  })
);

router.post(
  "/me/2fa/disable",
  limiter,
  authenticateAndCheckStatus,
  validateRequest({ body: disableSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    await twoFactorService.disable(userIdOf(req), (req as any).validatedData);
    sendResponse(res, { message: "Two-factor authentication is off" });
  })
);

router.post(
  "/me/2fa/recovery-codes",
  limiter,
  authenticateAndCheckStatus,
  validateRequest({ body: z.object({ code }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await twoFactorService.regenerateRecoveryCodes(userIdOf(req), (req as any).validatedData.code);
    sendResponse(res, { message: "New recovery codes created; the old ones no longer work", data: result });
  })
);

export default router;
