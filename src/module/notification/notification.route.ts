import { Request, Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/database";
import { authenticateAndCheckStatus } from "../../middleware/authMiddleware";
import { permissionsFor } from "../../middleware/permissions";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { validateRequest } from "../../utils/validateRequest";
import { notificationService } from "./notification.service";

const listSchema = z.object({
  unread: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
const idParamSchema = z.object({ id: z.string().uuid() });
export const preferencesSchema = z.object({ marketingEmails: z.boolean() });

const userOf = (req: Request) => (req as any).user as { id: string; role: string; marketingEmails?: boolean };

const router = Router();

router.get(
  "/me/notifications",
  authenticateAndCheckStatus,
  validateRequest({ query: listSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { notifications, unreadCount, pagination } = await notificationService.list(userOf(req).id, (req as any).validatedQuery);
    res.json({ success: true, message: "Notifications fetched", data: notifications, unreadCount, pagination });
  })
);

router.patch(
  "/me/notifications/:id/read",
  authenticateAndCheckStatus,
  validateRequest({ params: idParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    await notificationService.markRead(userOf(req).id, req.params.id);
    sendResponse(res, { message: "Notification marked as read" });
  })
);

router.post(
  "/me/notifications/read-all",
  authenticateAndCheckStatus,
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { message: "All notifications marked as read", data: await notificationService.markAllRead(userOf(req).id) });
  })
);

// Account preferences and what the signed-in user may do in the dashboard
router.get(
  "/me/preferences",
  authenticateAndCheckStatus,
  asyncHandler(async (req: Request, res: Response) => {
    const user = userOf(req);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { marketingEmails: true, twoFactorEnabled: true } });
    sendResponse(res, { message: "Preferences fetched", data: { ...stored, role: user.role, permissions: permissionsFor(user.role) } });
  })
);

router.patch(
  "/me/preferences",
  authenticateAndCheckStatus,
  validateRequest({ body: preferencesSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await prisma.user.update({
      where: { id: userOf(req).id },
      data: (req as any).validatedData,
      select: { marketingEmails: true },
    });
    sendResponse(res, { message: "Preferences saved", data: updated });
  })
);

export default router;
