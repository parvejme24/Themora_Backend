import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { productReviewService } from "./product-review.service";

const actorOf = (req: Request) => (req as any).user as { id: string; role: string };

export const listProductReviews = asyncHandler(async (req: Request, res: Response) => {
  const { reviews, summary, pagination } = await productReviewService.listForProduct(
    req.params.slug,
    (req as any).validatedQuery
  );
  res.status(200).json({ success: true, message: "Reviews fetched successfully", data: reviews, summary, pagination });
});

export const createProductReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await productReviewService.create(req.params.slug, actorOf(req).id, (req as any).validatedData);
  sendResponse(res, { statusCode: 201, message: "Review submitted successfully", data: review });
});

export const updateProductReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await productReviewService.update(req.params.id, actorOf(req), (req as any).validatedData);
  sendResponse(res, { message: "Review updated successfully", data: review });
});

export const deleteProductReview = asyncHandler(async (req: Request, res: Response) => {
  await productReviewService.remove(req.params.id, actorOf(req));
  sendResponse(res, { message: "Review deleted successfully" });
});

export const listMyReviews = asyncHandler(async (req: Request, res: Response) => {
  const reviews = await productReviewService.listMine(actorOf(req).id);
  sendResponse(res, { message: "Your reviews fetched successfully", data: reviews });
});

export const adminListReviews = asyncHandler(async (req: Request, res: Response) => {
  const { reviews, pagination } = await productReviewService.adminList((req as any).validatedQuery);
  sendResponse(res, { message: "Reviews fetched successfully", data: reviews, pagination });
});

export const setReviewStatus = asyncHandler(async (req: Request, res: Response) => {
  const review = await productReviewService.setStatus(req.params.id, (req as any).validatedData.status);
  sendResponse(res, { message: "Review status updated", data: review });
});

export const replyToReview = asyncHandler(async (req: Request, res: Response) => {
  const reply = await productReviewService.reply(req.params.id, actorOf(req), (req as any).validatedData.body);
  sendResponse(res, { statusCode: 201, message: "Reply posted successfully", data: reply });
});

export const deleteReviewReply = asyncHandler(async (req: Request, res: Response) => {
  await productReviewService.removeReply(req.params.id, actorOf(req));
  sendResponse(res, { message: "Reply deleted successfully" });
});
