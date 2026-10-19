import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/AppError";
import { buildPaginationMeta } from "../../utils/pagination";
import { withActiveSale } from "../../utils/pricing";
import { slugify, uniqueProductSlug } from "../../utils/slug";
import { CreateProductInput, ProductQuery, UpdateProductInput } from "./product.validation";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Fields shown on product cards (listing, related, wishlist)
export const productCardSelect = {
  id: true,
  slug: true,
  title: true,
  shortDescription: true,
  productType: true,
  price: true,
  salePrice: true,
  saleEndsAt: true,
  extendedPrice: true,
  isFree: true,
  isFeatured: true,
  techStack: true,
  platforms: true,
  imageUrl: true,
  previewLink: true,
  avgRating: true,
  reviewCount: true,
  totalPurchase: true,
  downloads: true,
  version: true,
  publishedAt: true,
  category: { select: { id: true, title: true, slug: true } },
  tags: { select: { name: true, slug: true } },
} satisfies Prisma.TemplateSelect;

const productDetailInclude = {
  category: { select: { id: true, title: true, slug: true, image: true } },
  tags: { select: { name: true, slug: true } },
  links: true,
  seller: { select: { id: true, fullName: true, profile: { select: { avatarUrl: true } } } },
} satisfies Prisma.TemplateInclude;

const sortToOrderBy: Record<ProductQuery["sort"], Prisma.TemplateOrderByWithRelationInput[]> = {
  newest: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  popular: [{ viewCount: "desc" }, { createdAt: "desc" }],
  bestselling: [{ totalPurchase: "desc" }, { createdAt: "desc" }],
  rating: [{ avgRating: "desc" }, { reviewCount: "desc" }],
  price_asc: [{ price: "asc" }],
  price_desc: [{ price: "desc" }],
  downloads: [{ downloads: "desc" }],
};

export const buildWhere = (query: ProductQuery, { publicOnly }: { publicOnly: boolean }): Prisma.TemplateWhereInput => {
  const and: Prisma.TemplateWhereInput[] = [];

  if (publicOnly) and.push({ status: "PUBLISHED" });
  else if (query.status) and.push({ status: query.status });

  if (query.q) {
    const term = query.q;
    and.push({
      OR: [
        { title: { contains: term, mode: "insensitive" } },
        { shortDescription: { contains: term, mode: "insensitive" } },
        { techStack: { has: term } },
        { tags: { some: { name: { contains: term, mode: "insensitive" } } } },
        { category: { title: { contains: term, mode: "insensitive" } } },
      ],
    });
  }
  if (query.type?.length) and.push({ productType: { in: query.type } });
  if (query.category?.length) and.push({ category: { slug: { in: query.category } } });
  if (query.tech?.length) and.push({ techStack: { hasSome: query.tech } });
  if (query.platform?.length) and.push({ platforms: { hasSome: query.platform } });
  if (query.tag?.length) and.push({ tags: { some: { slug: { in: query.tag } } } });
  if (query.free !== undefined) and.push({ isFree: query.free });
  if (query.featured !== undefined) and.push({ isFeatured: query.featured });
  if (query.rating !== undefined) and.push({ avgRating: { gte: query.rating } });
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    and.push({ price: { gte: query.minPrice, lte: query.maxPrice } });
  }

  return and.length ? { AND: and } : {};
};

// Counts values across string arrays, most common first (ties alphabetical)
const countValues = (lists: string[][]) => {
  const counts = new Map<string, number>();
  for (const value of lists.flat()) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
};

const tagsConnect = (names: string[]) =>
  names
    .map((name) => ({ name: name.trim(), slug: slugify(name) }))
    .filter((tag) => tag.slug)
    .map((tag) => ({ where: { slug: tag.slug }, create: tag }));

export const findProductByIdOrSlug = (idOrSlug: string) =>
  UUID_PATTERN.test(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug };

// A user owns a product when they have an active licence for it or a
// completed order containing it (legacy single-product or cart item).
export const userOwnsProduct = async (userId: string, productId: string) => {
  const [license, order] = await Promise.all([
    prisma.license.findFirst({ where: { userId, templateId: productId, isActive: true }, select: { id: true } }),
    prisma.orderInvoice.findFirst({
      where: {
        userId,
        status: "COMPLETED",
        OR: [{ templateId: productId }, { items: { some: { productId } } }],
      },
      select: { id: true },
    }),
  ]);
  return Boolean(license || order);
};

export class ProductService {
  async list(query: ProductQuery, { publicOnly = true } = {}) {
    const where = buildWhere(query, { publicOnly });
    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      prisma.template.findMany({
        where,
        orderBy: sortToOrderBy[query.sort],
        skip,
        take: query.limit,
        select: publicOnly ? productCardSelect : { ...productCardSelect, status: true, viewCount: true, updatedAt: true },
      }),
      prisma.template.count({ where }),
    ]);

    return { items: items.map(withActiveSale), pagination: buildPaginationMeta(total, query.page, query.limit) };
  }

  async getPublic(idOrSlug: string) {
    const product = await prisma.template.findFirst({
      where: { ...findProductByIdOrSlug(idOrSlug), status: "PUBLISHED" },
      include: productDetailInclude,
    });
    if (!product) throw AppError.notFound("Product not found");

    const { sourceFiles, sellerId, ...rest } = product;
    return withActiveSale({ ...rest, sourceFileCount: sourceFiles.length });
  }

  async getForAdmin(id: string) {
    const product = await prisma.template.findUnique({ where: { id }, include: productDetailInclude });
    if (!product) throw AppError.notFound("Product not found");
    return product;
  }

  async recordView(productId: string) {
    await prisma.template.updateMany({ where: { id: productId }, data: { viewCount: { increment: 1 } } });
  }

  async related(idOrSlug: string, limit: number) {
    const product = await prisma.template.findFirst({
      where: { ...findProductByIdOrSlug(idOrSlug), status: "PUBLISHED" },
      select: { id: true, categoryId: true, productType: true, tags: { select: { id: true } } },
    });
    if (!product) throw AppError.notFound("Product not found");

    const tagIds = product.tags.map((tag) => tag.id);
    const related = await prisma.template.findMany({
      where: {
        status: "PUBLISHED",
        id: { not: product.id },
        OR: [
          { categoryId: product.categoryId },
          { productType: product.productType },
          ...(tagIds.length ? [{ tags: { some: { id: { in: tagIds } } } }] : []),
        ],
      },
      orderBy: [{ totalPurchase: "desc" }, { avgRating: "desc" }],
      take: limit,
      select: productCardSelect,
    });
    return related.map(withActiveSale);
  }

  // Puts paid products on sale until endsAt (salePrice = price - percent)
  async startSale(input: { productIds?: string[]; categoryId?: string; percent: number; endsAt: Date }) {
    const products = await prisma.template.findMany({
      where: {
        status: "PUBLISHED",
        isFree: false,
        ...(input.categoryId ? { categoryId: input.categoryId } : { id: { in: input.productIds } }),
      },
      select: { id: true, price: true },
    });
    await prisma.$transaction(
      products.map((product) =>
        prisma.template.update({
          where: { id: product.id },
          data: { salePrice: Math.round(product.price * (100 - input.percent)) / 100, saleEndsAt: input.endsAt },
        })
      )
    );
    return { updated: products.length };
  }

  async endSale(input: { productIds?: string[]; categoryId?: string }) {
    const result = await prisma.template.updateMany({
      where: input.categoryId ? { categoryId: input.categoryId } : { id: { in: input.productIds } },
      data: { salePrice: null, saleEndsAt: null },
    });
    return { updated: result.count };
  }

  // Counts for the storefront filter sidebar (published products only)
  async facets() {
    const [types, categories, arrays, priceRange, freeCount] = await Promise.all([
      prisma.template.groupBy({ by: ["productType"], where: { status: "PUBLISHED" }, _count: { _all: true } }),
      prisma.templateCategory.findMany({
        select: {
          id: true,
          title: true,
          slug: true,
          _count: { select: { templates: { where: { status: "PUBLISHED" } } } },
        },
        orderBy: { title: "asc" },
      }),
      prisma.template.findMany({ where: { status: "PUBLISHED" }, select: { techStack: true, platforms: true } }),
      prisma.template.aggregate({ where: { status: "PUBLISHED" }, _min: { price: true }, _max: { price: true } }),
      prisma.template.count({ where: { status: "PUBLISHED", isFree: true } }),
    ]);

    return {
      types: types
        .map((row) => ({ value: row.productType, count: row._count._all }))
        .sort((a, b) => b.count - a.count),
      categories: categories
        .map((category) => ({ id: category.id, title: category.title, slug: category.slug, count: category._count.templates }))
        .filter((category) => category.count > 0),
      techStack: countValues(arrays.map((row) => row.techStack)).slice(0, 40),
      platforms: countValues(arrays.map((row) => row.platforms)),
      price: { min: priceRange._min.price ?? 0, max: priceRange._max.price ?? 0 },
      freeCount,
    };
  }

  async listTags() {
    const tags = await prisma.tag.findMany({
      select: { name: true, slug: true, _count: { select: { products: { where: { status: "PUBLISHED" } } } } },
      orderBy: { name: "asc" },
    });
    return tags
      .map((tag) => ({ name: tag.name, slug: tag.slug, count: tag._count.products }))
      .filter((tag) => tag.count > 0);
  }

  async create(input: CreateProductInput, sellerId?: string) {
    const { tags, slug, categoryId, ...data } = input;
    await this.assertCategoryExists(categoryId);
    if (slug) await this.assertSlugAvailable(slug);

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.template.create({
        data: {
          ...data,
          price: data.isFree ? 0 : data.price,
          keyFeatures: data.keyFeatures as Prisma.InputJsonValue[],
          slug: slug ?? (await uniqueProductSlug(data.title)),
          publishedAt: data.status === "PUBLISHED" ? new Date() : null,
          category: { connect: { id: categoryId } },
          ...(sellerId ? { seller: { connect: { id: sellerId } } } : {}),
          tags: { connectOrCreate: tagsConnect(tags) },
        },
        include: productDetailInclude,
      });
      await tx.templateCategory.update({ where: { id: categoryId }, data: { templateCount: { increment: 1 } } });
      return created;
    });
    return product;
  }

  async update(id: string, input: UpdateProductInput) {
    const existing = await prisma.template.findUnique({
      where: { id },
      select: { id: true, categoryId: true, status: true, publishedAt: true, price: true, isFree: true },
    });
    if (!existing) throw AppError.notFound("Product not found");

    const { tags, slug, categoryId, keyFeatures, ...data } = input;
    if (categoryId && categoryId !== existing.categoryId) await this.assertCategoryExists(categoryId);
    if (slug) await this.assertSlugAvailable(slug, id);

    const isFree = data.isFree ?? existing.isFree;
    const price = isFree ? 0 : data.price;
    const becomesPublished = data.status === "PUBLISHED" && !existing.publishedAt;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.template.update({
        where: { id },
        data: {
          ...data,
          ...(price !== undefined ? { price } : {}),
          ...(slug ? { slug } : {}),
          ...(keyFeatures ? { keyFeatures: keyFeatures as Prisma.InputJsonValue[] } : {}),
          ...(becomesPublished ? { publishedAt: new Date() } : {}),
          ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
          ...(tags ? { tags: { set: [], connectOrCreate: tagsConnect(tags) } } : {}),
        },
        include: productDetailInclude,
      });

      if (categoryId && categoryId !== existing.categoryId) {
        await tx.templateCategory.update({ where: { id: existing.categoryId }, data: { templateCount: { decrement: 1 } } });
        await tx.templateCategory.update({ where: { id: categoryId }, data: { templateCount: { increment: 1 } } });
      }
      return updated;
    });
  }

  // Products with purchase history are archived instead of deleted, so
  // buyers keep their orders, licences and downloads.
  async remove(id: string) {
    const product = await prisma.template.findUnique({
      where: { id },
      select: { id: true, categoryId: true, _count: { select: { orders: true, licenses: true } } },
    });
    if (!product) throw AppError.notFound("Product not found");

    if (product._count.orders > 0 || product._count.licenses > 0) {
      await prisma.template.update({ where: { id }, data: { status: "ARCHIVED" } });
      return { archived: true };
    }

    await prisma.$transaction([
      prisma.template.delete({ where: { id } }),
      prisma.templateCategory.update({ where: { id: product.categoryId }, data: { templateCount: { decrement: 1 } } }),
    ]);
    return { archived: false };
  }

  private async assertCategoryExists(categoryId: string) {
    const category = await prisma.templateCategory.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!category) throw AppError.badRequest("Category does not exist");
  }

  private async assertSlugAvailable(slug: string, excludeId?: string) {
    const taken = await prisma.template.findFirst({
      where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (taken) throw AppError.conflict("Another product already uses this slug");
  }
}

export const productService = new ProductService();
