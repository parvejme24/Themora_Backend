import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError";
import { env } from "../config/env";
import { captureError } from "../config/monitoring";

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`,
    error: "Route not found",
  });
};

const fromPrismaError = (err: Prisma.PrismaClientKnownRequestError): AppError => {
  switch (err.code) {
    case "P2002": {
      const target = err.meta?.target as string[] | string | undefined;
      const fields = Array.isArray(target) ? target.join(", ") : target || "value";
      return AppError.conflict(`A record with this ${fields} already exists`);
    }
    case "P2025":
      return AppError.notFound((err.meta?.cause as string) || "Record not found");
    case "P2003":
      return AppError.badRequest("Related record does not exist");
    default:
      return new AppError(500, "Database error");
  }
};

// Global error handler: AppError, ZodError and Prisma errors become clean
// JSON responses; anything else is a 500 with details hidden in production.
export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: err.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
  }

  let appError: AppError;
  if (err instanceof AppError) {
    appError = err;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    appError = fromPrismaError(err);
  } else if ((err as any)?.type === "entity.parse.failed") {
    appError = AppError.badRequest("Malformed JSON body");
  } else {
    appError = new AppError(500, "Internal Server Error");
  }

  if (appError.statusCode >= 500) {
    captureError(err, { path: _req.originalUrl, method: _req.method });
  }

  const exposeDetails = env.NODE_ENV !== "production" && appError.statusCode >= 500;
  return res.status(appError.statusCode).json({
    success: false,
    message: appError.message,
    ...(appError.details !== undefined ? { errors: appError.details } : {}),
    ...(exposeDetails && err instanceof Error ? { error: err.message } : {}),
  });
};
