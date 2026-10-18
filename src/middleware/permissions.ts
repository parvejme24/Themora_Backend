import { NextFunction, Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { authenticateAndCheckStatus } from "./authMiddleware";

export type Permission =
  | "catalog:write" // products, versions, sales, uploads
  | "reviews:moderate" // product reviews and replies
  | "support" // tickets, refunds, customer lookups
  | "marketing" // coupons, affiliates
  | "analytics" // dashboards and reports
  | "audit"; // audit log

// ADMIN can do everything; staff roles get a focused set
const rolePermissions: Record<UserRole, Permission[]> = {
  ADMIN: ["catalog:write", "reviews:moderate", "support", "marketing", "analytics", "audit"],
  EDITOR: ["catalog:write", "marketing", "analytics"],
  SUPPORT: ["support"],
  MODERATOR: ["reviews:moderate"],
  USER: [],
};

export const STAFF_ROLES: UserRole[] = ["ADMIN", "EDITOR", "SUPPORT", "MODERATOR"];

export const hasPermission = (role: string | undefined, permission: Permission) =>
  Boolean(role && rolePermissions[role as UserRole]?.includes(permission));

export const permissionsFor = (role: string | undefined) => (role ? rolePermissions[role as UserRole] ?? [] : []);

const requirePermission = (permission: Permission) => (req: Request, res: Response, next: NextFunction) => {
  const role = (req as any).user?.role;
  if (!hasPermission(role, permission)) {
    return res.status(403).json({ success: false, message: "You do not have permission to do this" });
  }
  return next();
};

// Sign-in + account status check + permission, for route definitions
export const authorize = (permission: Permission) => [...authenticateAndCheckStatus, requirePermission(permission)];
