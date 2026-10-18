import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { STAFF_ROLES } from "./permissions";
import { runInBackground } from "../utils/background";

// Admin resources: the new /admin API plus the legacy admin routes
const AUDITED_PATHS = /^\/(admin|auth\/users|templates|template-categories|blogs?|blog-categories|blog-reviews|pricing|orders|tickets|contacts?|newsletters?)(\/|$)/;
const SECRET_FIELDS = /pass(word)?|otp|token|secret|signature|payoutDetails/i;
const MAX_METADATA_BYTES = 4000;

const redact = (value: unknown, depth = 0): unknown => {
  if (depth > 3 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, SECRET_FIELDS.test(key) ? "[redacted]" : redact(item, depth + 1)])
  );
};

const metadataFor = (body: unknown): Prisma.InputJsonValue | undefined => {
  if (!body || typeof body !== "object" || Object.keys(body).length === 0) return undefined;
  const json = JSON.stringify(redact(body));
  return json.length > MAX_METADATA_BYTES ? { truncated: true, keys: Object.keys(body as object) } : JSON.parse(json);
};

/**
 * Records every successful change a staff member makes to admin resources:
 * who, what, which record, the (redacted) request body and IP. Runs after
 * the response is sent and never affects the request.
 */
export const auditStaffActions = (req: Request, res: Response, next: NextFunction) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || !AUDITED_PATHS.test(req.path)) return next();

  res.on("finish", () => {
    const user = (req as any).user as { id: string; role: string } | undefined;
    if (!user || !STAFF_ROLES.includes(user.role as any) || res.statusCode >= 400) return;

    const routePath = req.route?.path ?? req.path;
    const segments = String(routePath).split("/").filter((segment) => segment && !segment.startsWith(":"));
    const entityType = segments[0] === "admin" ? segments[1] : segments[0];
    const entityId = req.params?.id ?? req.params?.productId ?? req.params?.templateId ?? null;

    runInBackground("audit log", () =>
      prisma.auditLog.create({
        data: {
          actorId: user.id,
          actorRole: user.role,
          action: `${req.method} ${req.baseUrl}${routePath}`,
          entityType: entityType ?? null,
          entityId,
          metadata: metadataFor(req.body),
          ip: req.ip ?? null,
        },
      })
    );
  });
  next();
};
