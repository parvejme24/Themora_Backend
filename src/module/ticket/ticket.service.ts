import { Prisma, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "../../config/database";
import { hasPermission } from "../../middleware/permissions";
import { AppError } from "../../utils/AppError";
import { buildPaginationMeta } from "../../utils/pagination";
import { notificationService } from "../notification/notification.service";
import { userOwnsProduct } from "../product/product.service";

interface Actor {
  id: string;
  role: string;
}

const isStaff = (actor: Actor) => hasPermission(actor.role, "support");

const ticketInclude = {
  product: { select: { id: true, slug: true, title: true, imageUrl: true } },
  order: { select: { id: true, orderNumber: true } },
  assignedTo: { select: { id: true, fullName: true } },
} satisfies Prisma.SupportTicketInclude;

const messageInclude = {
  author: { select: { id: true, fullName: true, role: true, profile: { select: { avatarUrl: true } } } },
} satisfies Prisma.TicketMessageInclude;

export class TicketService {
  async create(
    actor: Actor & { email: string },
    input: { subject: string; message: string; productId?: string; orderId?: string; priority?: TicketPriority; attachments?: string[] }
  ) {
    // Product tickets are for buyers; anyone can open a general ticket
    if (input.productId && !(await userOwnsProduct(actor.id, input.productId))) {
      const product = await prisma.template.findUnique({ where: { id: input.productId }, select: { isFree: true } });
      if (!product?.isFree) throw AppError.forbidden("You can open product tickets only for products you own");
    }
    if (input.orderId) {
      const order = await prisma.orderInvoice.findFirst({
        where: { id: input.orderId, OR: [{ userId: actor.id }, { customerEmail: actor.email }] },
        select: { id: true },
      });
      if (!order) throw AppError.notFound("Order not found");
    }

    return prisma.supportTicket.create({
      data: {
        userId: actor.id,
        subject: input.subject,
        productId: input.productId ?? null,
        orderId: input.orderId ?? null,
        // Customers may flag HIGH; URGENT is set by staff
        priority: input.priority === "URGENT" ? "HIGH" : input.priority ?? "NORMAL",
        messages: { create: { authorId: actor.id, body: input.message, attachments: input.attachments ?? [] } },
      },
      include: { ...ticketInclude, messages: { include: messageInclude } },
    });
  }

  async listMine(userId: string, query: { status?: TicketStatus; page: number; limit: number }) {
    const where: Prisma.SupportTicketWhereInput = { userId, ...(query.status ? { status: query.status } : {}) };
    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy: { lastMessageAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: ticketInclude,
      }),
      prisma.supportTicket.count({ where }),
    ]);
    return { tickets, pagination: buildPaginationMeta(total, query.page, query.limit) };
  }

  async get(actor: Actor, id: string) {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        ...ticketInclude,
        user: { select: { id: true, fullName: true, email: true } },
        messages: { orderBy: { createdAt: "asc" }, include: messageInclude },
      },
    });
    if (!ticket || (ticket.userId !== actor.id && !isStaff(actor))) throw AppError.notFound("Ticket not found");
    return ticket;
  }

  // Customer replies reopen the ticket for support; staff replies wait on the customer
  async reply(actor: Actor, id: string, body: string, attachments: string[] = []) {
    const ticket = await this.get(actor, id);
    if (ticket.status === "CLOSED") throw AppError.badRequest("This ticket is closed. Please open a new one");
    const staffReply = isStaff(actor) && ticket.userId !== actor.id;

    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.ticketMessage.create({
        data: { ticketId: id, authorId: actor.id, body, attachments, isStaff: staffReply },
        include: messageInclude,
      });
      await tx.supportTicket.update({
        where: { id },
        data: {
          status: staffReply ? "AWAITING_CUSTOMER" : "AWAITING_SUPPORT",
          lastMessageAt: new Date(),
          ...(staffReply && !ticket.assignedToId ? { assignedToId: actor.id } : {}),
        },
      });
      return created;
    });

    const recipient = staffReply ? ticket.userId : ticket.assignedToId;
    await notificationService.notify(recipient, {
      type: "ticket_reply",
      title: `New reply on ticket #${ticket.number}: ${ticket.subject}`,
      body: body.slice(0, 200),
      link: staffReply ? `/dashboard/support/${id}` : `/dashboard/tickets/${id}`,
    });
    return message;
  }

  async close(actor: Actor, id: string) {
    await this.get(actor, id);
    return prisma.supportTicket.update({ where: { id }, data: { status: "CLOSED" }, include: ticketInclude });
  }

  // ── Staff ──────────────────────────────────────────────────────────────

  async staffList(query: { status?: TicketStatus; priority?: TicketPriority; assignedToId?: string; unassigned?: boolean; q?: string; page: number; limit: number }) {
    const where: Prisma.SupportTicketWhereInput = {
      ...(query.status ? { status: query.status } : { status: { in: ["AWAITING_SUPPORT", "AWAITING_CUSTOMER"] } }),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(query.unassigned ? { assignedToId: null } : {}),
      ...(query.q
        ? {
            OR: [
              { subject: { contains: query.q, mode: "insensitive" } },
              { user: { email: { contains: query.q, mode: "insensitive" } } },
              ...(/^\d+$/.test(query.q) ? [{ number: Number(query.q) }] : []),
            ],
          }
        : {}),
    };
    const [tickets, total, counts] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        // Urgent first, then the longest-waiting
        orderBy: [{ priority: "desc" }, { lastMessageAt: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { ...ticketInclude, user: { select: { id: true, fullName: true, email: true } } },
      }),
      prisma.supportTicket.count({ where }),
      prisma.supportTicket.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    const byStatus = Object.fromEntries(counts.map((row) => [row.status, row._count._all]));
    return { tickets, byStatus, pagination: buildPaginationMeta(total, query.page, query.limit) };
  }

  async staffUpdate(actor: Actor, id: string, input: { status?: TicketStatus; priority?: TicketPriority; assignedToId?: string | null }) {
    const ticket = await this.get(actor, id);
    if (input.assignedToId) {
      const assignee = await prisma.user.findUnique({ where: { id: input.assignedToId }, select: { role: true } });
      if (!assignee || !hasPermission(assignee.role, "support")) throw AppError.badRequest("Tickets can only be assigned to support staff");
    }
    const updated = await prisma.supportTicket.update({ where: { id }, data: input, include: ticketInclude });
    if (input.assignedToId && input.assignedToId !== ticket.assignedToId && input.assignedToId !== actor.id) {
      await notificationService.notify(input.assignedToId, {
        type: "ticket_assigned",
        title: `Ticket #${ticket.number} was assigned to you`,
        body: ticket.subject,
        link: `/dashboard/support/${id}`,
      });
    }
    return updated;
  }
}

export const ticketService = new TicketService();
