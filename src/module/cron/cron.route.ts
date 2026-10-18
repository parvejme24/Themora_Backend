import crypto from "node:crypto";
import { NextFunction, Request, Response, Router } from "express";
import { env } from "../../config/env";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { cronService } from "./cron.service";

// Vercel Cron calls with "Authorization: Bearer <CRON_SECRET>"
const requireCronSecret = (req: Request, res: Response, next: NextFunction) => {
  if (!env.CRON_SECRET) return res.status(503).json({ success: false, message: "Cron is not configured" });
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  const received = Buffer.from(String(req.headers.authorization ?? ""));
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  return next();
};

const router = Router();

router.get(
  "/internal/cron/daily",
  requireCronSecret,
  asyncHandler(async (_req: Request, res: Response) => {
    sendResponse(res, { message: "Daily jobs finished", data: await cronService.runDaily() });
  })
);

export default router;
