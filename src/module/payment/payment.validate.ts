import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { createCheckoutSchema } from "./payment.type";

export const validateCreateCheckout = (req: Request, res: Response, next: NextFunction) => {
  const result = z.object({ body: createCheckoutSchema }).safeParse(req);
  if (!result.success) {
    res.status(400).json({ success: false, message: "Invalid checkout details", errors: result.error.issues });
    return;
  }
  (req as any).validatedBody = result.data.body;
  next();
};
