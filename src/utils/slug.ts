import crypto from "node:crypto";
import { prisma } from "../config/database";

export const slugify = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

// Returns a product slug that no other product uses. Falls back to a random
// suffix when the base slug is taken.
export const uniqueProductSlug = async (title: string, excludeId?: string) => {
  const base = slugify(title) || "product";
  const taken = await prisma.template.findFirst({
    where: { slug: base, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true },
  });
  return taken ? `${base}-${crypto.randomBytes(3).toString("hex")}` : base;
};
