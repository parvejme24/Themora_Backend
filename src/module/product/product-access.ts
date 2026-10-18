import { prisma } from "../../config/database";
import { hasPermission } from "../../middleware/permissions";
import { subscriptionService } from "../subscription/subscription.service";
import { userOwnsProduct } from "./product.service";

interface AccessUser {
  id: string;
  role: string;
}

/**
 * Who may download a product's files: catalogue and support staff, buyers, customers with an
 * active one-time plan, all-access subscribers, and anyone signed in for
 * free products.
 */
export const canDownloadProduct = async (user: AccessUser, product: { id: string; isFree: boolean; status: string }) => {
  if (hasPermission(user.role, "catalog:write") || hasPermission(user.role, "support")) return true;
  if (product.isFree && product.status === "PUBLISHED") return true;

  const [owns, planEntitlement, allAccess] = await Promise.all([
    userOwnsProduct(user.id, product.id),
    prisma.planEntitlement.findFirst({
      where: { userId: user.id, isActive: true, order: { status: "COMPLETED" } },
      select: { id: true },
    }),
    subscriptionService.hasAllAccess(user.id),
  ]);
  return owns || Boolean(planEntitlement) || allAccess;
};
