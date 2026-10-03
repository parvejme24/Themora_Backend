import { Request, Response } from "express";
import { paymentService } from "./payment.service";

export const createCheckout = async (req: Request, res: Response) => {
  try {
    const input = (req as any).validatedBody;
    const user = (req as any).user;
    if (user && (user.isBanned || user.isTrashed || user.isDeletedPermanently)) {
      return res.status(403).json({ success: false, message: "This account cannot make purchases" });
    }

    const checkout = await paymentService.createCheckout(input, user);
    return res.status(201).json({ success: true, data: checkout });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create checkout";
    const status = message === "Payment checkout is not configured" ? 503
      : message === "Theme not found" || message === "Pricing plan not found" ? 404
      : message === "A valid email address is required" ? 400
      : message === "This product is not configured for online checkout" ? 409
      : 502;
    return res.status(status).json({ success: false, message });
  }
};
