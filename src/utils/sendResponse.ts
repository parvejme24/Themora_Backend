import { Response } from "express";
import { PaginationMeta } from "./pagination";

interface ResponsePayload<T> {
  statusCode?: number;
  message: string;
  data?: T;
  pagination?: PaginationMeta;
}

// Standard success envelope: { success, message, data, pagination? }.
// Matches the shape the existing modules already return.
export const sendResponse = <T>(res: Response, payload: ResponsePayload<T>) => {
  const { statusCode = 200, message, data, pagination } = payload;
  return res.status(statusCode).json({
    success: true,
    message,
    data: data ?? null,
    ...(pagination ? { pagination } : {}),
  });
};
