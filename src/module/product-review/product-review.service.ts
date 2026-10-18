import { Prisma, ReviewStatus } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/AppError";
import { buildPaginationMeta } from "../../utils/pagination";
import { findProductByIdOrSlug, userOwnsProduct } from "../product/product.service";
import { hasPermission } from "../../middleware/permissions";
import { AdminReviewQuery, CreateReviewInput, ReviewQuery, UpdateReviewInput } from "./product-review.validation";

interface Actor {
  id: string;
  role: string;
}

const reviewInclude = {
  user: { select: { id: true, fullName: true, profile: { select: { avatarUrl: true } } } },
  replies: {
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, fullName: true, role: true, profile: { select: { avatarUrl: true } } } } },
  },
} satisfies Prisma.ProductReviewInclude;

const sortToOrderBy: Record<ReviewQuery["sort"], Prisma.ProductReviewOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }],
  highest: [{ rating: "desc" }, { createdAt: "desc" }],
  lowest: [{ rating: "asc" }, { createdAt: "desc" }],
};

// Keeps the denormalized avgRating/reviewCount on the product in sync.
// Only approved reviews count.
const recalculateProductRating = async (tx: Prisma.TransactionClient, productId: string) => {
  const stats = await tx.productReview.aggregate({
    where: { productId, status: "APPROVED" },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await tx.template.update({
    where: { id: productId },
    data: {
      avgRating: Math.round((stats._avg.rating ?? 0) * 10) / 10,
      reviewCount: stats._count._all,
    },
  });
};

export class ProductReviewService {
  async listForProduct(idOrSlug: string, query: ReviewQuery) {
    const product = await prisma.template.findFirst({
      where: { ...findProductByIdOrSlug(idOrSlug), status: "PUBLISHED" },
      select: { id: true, avgRating: true, reviewCount: true },
    });
    if (!product) throw AppError.notFound("Product not found");

    const where: Prisma.ProductReviewWhereInput = {
      productId: product.id,
      status: "APPROVED",
      ...(query.rating ? { rating: query.rating } : {}),
    };

    const [reviews, total, breakdownRows] = await Promise.all([
      prisma.productReview.findMany({
        where,
        orderBy: sortToOrderBy[query.sort],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: reviewInclude,
      }),
      prisma.productReview.count({ where }),
      prisma.productReview.groupBy({
        by: ["rating"],
        where: { productId: product.id, status: "APPROVED" },
        _count: { _all: true },
      }),
    ]);

    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } as Record<number, number>;
    for (const row of breakdownRows) breakdown[row.rating] = row._count._all;

    return {
      reviews,
      summary: { avgRating: product.avgRating, reviewCount: product.reviewCount, breakdown },
      pagination: buildPaginationMeta(total, query.page, query.limit),
    };
  }

  async create(idOrSlug: string, userId: string, input: CreateReviewInput) {
    const product = await prisma.template.findFirst({
      where: { ...findProductByIdOrSlug(idOrSlug), status: "PUBLISHED" },
      select: { id: true, isFree: true },
    });
    if (!product) throw AppError.notFound("Product not found");

    const owns = await userOwnsProduct(userId, product.id);
    if (!owns && !product.isFree) {
      throw AppError.forbidden("Only customers who bought this product can review it");
    }

    const existing = await prisma.productReview.findUnique({
      where: { productId_userId: { productId: product.id, userId } },
      select: { id: true },
    });
    if (existing) throw AppError.conflict("You have already reviewed this product. Edit your review instead");

    return prisma.$transaction(async (tx) => {
      const review = await tx.productReview.create({
        data: { ...input, productId: product.id, userId, isVerifiedBuyer: owns },
        include: reviewInclude,
      });
      await recalculateProductRating(tx, product.id);
      return review;
    });
  }

  async update(reviewId: string, actor: Actor, input: UpdateReviewInput) {
    const review = await this.findOrFail(reviewId);
    if (review.userId !== actor.id) throw AppError.forbidden("You can only edit your own review");

    return prisma.$transaction(async (tx) => {
      const updated = await tx.productReview.update({ where: { id: reviewId }, data: input, include: reviewInclude });
      await recalculateProductRating(tx, review.productId);
      return updated;
    });
  }

  async remove(reviewId: string, actor: Actor) {
    const review = await this.findOrFail(reviewId);
    if (review.userId !== actor.id && !hasPermission(actor.role, "reviews:moderate")) {
      throw AppError.forbidden("You can only delete your own review");
    }

    await prisma.$transaction(async (tx) => {
      await tx.productReview.delete({ where: { id: reviewId } });
      await recalculateProductRating(tx, review.productId);
    });
  }

  async listMine(userId: string) {
    return prisma.productReview.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { ...reviewInclude, product: { select: { id: true, slug: true, title: true, imageUrl: true } } },
    });
  }

  async adminList(query: AdminReviewQuery) {
    const where: Prisma.ProductReviewWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
    };
    const [reviews, total] = await Promise.all([
      prisma.productReview.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { ...reviewInclude, product: { select: { id: true, slug: true, title: true } } },
      }),
      prisma.productReview.count({ where }),
    ]);
    return { reviews, pagination: buildPaginationMeta(total, query.page, query.limit) };
  }

  async setStatus(reviewId: string, status: ReviewStatus) {
    const review = await this.findOrFail(reviewId);
    return prisma.$transaction(async (tx) => {
      const updated = await tx.productReview.update({ where: { id: reviewId }, data: { status }, include: reviewInclude });
      await recalculateProductRating(tx, review.productId);
      return updated;
    });
  }

  // Admins, or the product's seller, can reply to a review
  async reply(reviewId: string, actor: Actor, body: string) {
    const review = await prisma.productReview.findUnique({
      where: { id: reviewId },
      select: { id: true, product: { select: { sellerId: true } } },
    });
    if (!review) throw AppError.notFound("Review not found");
    if (!hasPermission(actor.role, "reviews:moderate") && review.product.sellerId !== actor.id) {
      throw AppError.forbidden("Only the seller or an admin can reply to reviews");
    }

    return prisma.productReviewReply.create({
      data: { reviewId, userId: actor.id, body },
      include: { user: { select: { id: true, fullName: true, role: true } } },
    });
  }

  async removeReply(replyId: string, actor: Actor) {
    const reply = await prisma.productReviewReply.findUnique({ where: { id: replyId }, select: { userId: true } });
    if (!reply) throw AppError.notFound("Reply not found");
    if (reply.userId !== actor.id && !hasPermission(actor.role, "reviews:moderate")) throw AppError.forbidden("You can only delete your own reply");
    await prisma.productReviewReply.delete({ where: { id: replyId } });
  }

  private async findOrFail(reviewId: string) {
    const review = await prisma.productReview.findUnique({
      where: { id: reviewId },
      select: { id: true, userId: true, productId: true },
    });
    if (!review) throw AppError.notFound("Review not found");
    return review;
  }
}

export const productReviewService = new ProductReviewService();
