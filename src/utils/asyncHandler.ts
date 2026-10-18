import { NextFunction, Request, RequestHandler, Response } from "express";

// Forwards rejected promises to the global error handler so controllers
// don't need their own try/catch.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
