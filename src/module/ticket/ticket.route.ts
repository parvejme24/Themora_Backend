import { Request, Response, Router } from "express";
import { z } from "zod";
import { authenticateAndCheckStatus } from "../../middleware/authMiddleware";
import { authorize } from "../../middleware/permissions";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { validateRequest } from "../../utils/validateRequest";
import { ticketService } from "./ticket.service";

const status = z.enum(["AWAITING_SUPPORT", "AWAITING_CUSTOMER", "RESOLVED", "CLOSED"]);
const priority = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);
const attachments = z.array(z.string().url()).max(5).default([]);

export const createTicketSchema = z.object({
  subject: z.string().trim().min(5).max(150),
  message: z.string().trim().min(10).max(5000),
  productId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  priority: priority.optional(),
  attachments,
});
export const replySchema = z.object({ body: z.string().trim().min(1).max(5000), attachments });
const idParamSchema = z.object({ id: z.string().uuid() });
const mineQuerySchema = z.object({
  status: status.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
const staffQuerySchema = mineQuerySchema.extend({
  priority: priority.optional(),
  assignedToId: z.string().uuid().optional(),
  unassigned: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  q: z.string().trim().max(100).optional(),
});
const staffUpdateSchema = z
  .object({ status: status.optional(), priority: priority.optional(), assignedToId: z.string().uuid().nullable().optional() })
  .refine((data) => Object.keys(data).length > 0, "Nothing to update");

const actorOf = (req: Request) => (req as any).user as { id: string; role: string; email: string };

const router = Router();

// Customers
router.post(
  "/me/tickets",
  authenticateAndCheckStatus,
  validateRequest({ body: createTicketSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const ticket = await ticketService.create(actorOf(req), (req as any).validatedData);
    sendResponse(res, { statusCode: 201, message: `Ticket #${ticket.number} opened`, data: ticket });
  })
);

router.get(
  "/me/tickets",
  authenticateAndCheckStatus,
  validateRequest({ query: mineQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { tickets, pagination } = await ticketService.listMine(actorOf(req).id, (req as any).validatedQuery);
    sendResponse(res, { message: "Tickets fetched", data: tickets, pagination });
  })
);

// Shared by customers (own tickets) and support staff (any ticket)
router.get(
  "/tickets/:id",
  authenticateAndCheckStatus,
  validateRequest({ params: idParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { message: "Ticket fetched", data: await ticketService.get(actorOf(req), req.params.id) });
  })
);

router.post(
  "/tickets/:id/messages",
  authenticateAndCheckStatus,
  validateRequest({ params: idParamSchema, body: replySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { body, attachments: files } = (req as any).validatedData;
    const message = await ticketService.reply(actorOf(req), req.params.id, body, files);
    sendResponse(res, { statusCode: 201, message: "Reply sent", data: message });
  })
);

router.post(
  "/tickets/:id/close",
  authenticateAndCheckStatus,
  validateRequest({ params: idParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { message: "Ticket closed", data: await ticketService.close(actorOf(req), req.params.id) });
  })
);

// Support staff
router.get(
  "/admin/tickets",
  authorize("support"),
  validateRequest({ query: staffQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { tickets, byStatus, pagination } = await ticketService.staffList((req as any).validatedQuery);
    res.json({ success: true, message: "Tickets fetched", data: tickets, byStatus, pagination });
  })
);

router.patch(
  "/admin/tickets/:id",
  authorize("support"),
  validateRequest({ params: idParamSchema, body: staffUpdateSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { message: "Ticket updated", data: await ticketService.staffUpdate(actorOf(req), req.params.id, (req as any).validatedData) });
  })
);

export default router;
