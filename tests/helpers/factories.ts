import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../src/config/database";

const suffix = () => crypto.randomBytes(4).toString("hex");

export const createCategory = (overrides: Partial<Prisma.TemplateCategoryCreateInput> = {}) => {
  const id = suffix();
  return prisma.templateCategory.create({
    data: { title: `Category ${id}`, slug: `category-${id}`, ...overrides },
  });
};

type ProductOverrides = Partial<Omit<Prisma.TemplateUncheckedCreateInput, "categoryId">> & { categoryId?: string };

export const createProduct = async (overrides: ProductOverrides = {}) => {
  const categoryId = overrides.categoryId ?? (await createCategory()).id;
  const id = suffix();
  return prisma.template.create({
    data: {
      title: `Product ${id}`,
      slug: `product-${id}`,
      price: 49,
      shortDescription: "A production-ready product used in tests.",
      version: 1,
      status: "PUBLISHED",
      publishedAt: new Date(),
      ...overrides,
      categoryId,
    },
  });
};

export const createCompletedOrder = (userId: string, productId: string, email = "buyer@themora.test") =>
  prisma.orderInvoice.create({
    data: {
      userId,
      templateId: productId,
      lemonsqueezyOrderId: `test_${suffix()}`,
      status: "COMPLETED",
      totalAmount: 49,
      licenseType: "SINGLE",
      customerEmail: email,
    },
  });
