import { Request, Response } from "express";
import { blogReviewService } from "./blog-review.service";
import { IBlogReviewQuery } from "./blog-review.interface";

// Create blog review
export const createBlogReview = async (req: Request, res: Response) => {
  try {
    const { blogId } = req.params;
    const user = (req as any).user;
    const body = req.body;
    const reviewData = {
      ...body,
      commentText: body.commentText || body.comment,
      blogId,
      userId: user?.id || body.userId,
      fullName: user?.fullName || body.fullName || body.name || "Reader",
      email: user?.email || body.email,
    };

    if (user?.id) {
      const hasReviewed = await blogReviewService.hasUserReviewed(blogId, user.id);
      if (hasReviewed) {
        return res.status(400).json({
          success: false,
          message: "You have already reviewed this blog",
          error: "Duplicate review not allowed",
        });
      }
    }

    const review = await blogReviewService.createBlogReview(reviewData);

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully.",
      data: review,
    });
  } catch (error) {
    console.error("Error creating blog review:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create blog review",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Create blog review reply
export const createBlogReviewReply = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const admin = (req as any).user;
    if (!admin?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "Admin user not found in context",
      });
    }
    const body = req.body;
    const replyData = {
      ...body,
      replyText: body.replyText || body.reply || body.comment,
      reviewId,
      adminId: admin.id,
      fullName: admin.fullName || body.fullName || "Admin",
      email: admin.email || body.email,
    } as any;

    const reply = await blogReviewService.createBlogReviewReply(replyData);

    return res.status(201).json({
      success: true,
      message: "Reply submitted successfully.",
      data: reply,
    });
  } catch (error) {
    console.error("Error creating blog review reply:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create blog review reply",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get blog reviews
export const getBlogReviews = async (req: Request, res: Response) => {
  try {
    const query: IBlogReviewQuery = (req as any).validatedQuery || req.query;
    const user = (req as any).user;
    const isAdmin = user?.role === 'ADMIN';
    const result = await blogReviewService.getBlogReviews(query, isAdmin);

    return res.status(200).json({
      success: true,
      message: "Blog reviews fetched successfully",
      data: result.reviews,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error fetching blog reviews:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch blog reviews",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get reviews by blog ID
export const getReviewsByBlogId = async (req: Request, res: Response) => {
  try {
    const { blogId } = req.params;
    const query: IBlogReviewQuery = (req as any).validatedQuery || req.query;
    const user = (req as any).user;
    const isAdmin = user?.role === 'ADMIN';
    
    const result = await blogReviewService.getReviewsByBlogId(blogId, query, isAdmin);

    return res.status(200).json({
      success: true,
      message: "Blog reviews fetched successfully",
      data: result.reviews,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error fetching blog reviews:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch blog reviews",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get blog review by ID
export const getBlogReviewById = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const user = (req as any).user;
    const isAdmin = user?.role === 'ADMIN';
    
    const review = await blogReviewService.getBlogReviewById(reviewId);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
        data: null,
      });
    }

    // Hide review from non-admin users if it's hidden
    if (!isAdmin && review.isHidden) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Review fetched successfully",
      data: review,
    });
  } catch (error) {
    console.error("Error fetching blog review:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch blog review",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Update blog review (owner or admin)
export const updateBlogReview = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "User not authenticated",
      });
    }

    // Get the review to check ownership
    const review = await blogReviewService.getBlogReviewById(reviewId);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
        data: null,
      });
    }

    // Check if user is owner or admin
    const isOwner = review.userId === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Permission denied",
        error: "You can only update your own reviews",
      });
    }

    const updatedReview = await blogReviewService.updateBlogReview(reviewId, req.body);

    return res.status(200).json({
      success: true,
      message: "Review updated successfully",
      data: updatedReview,
    });
  } catch (error) {
    console.error("Error updating blog review:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update blog review",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Hide blog review (admin only)
export const hideBlogReview = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    
    const review = await blogReviewService.hideBlogReview(reviewId);

    return res.status(200).json({
      success: true,
      message: "Review hidden successfully",
      data: review,
    });
  } catch (error) {
    console.error("Error hiding blog review:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to hide blog review",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Unhide blog review (admin only)
export const unhideBlogReview = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    
    const review = await blogReviewService.unhideBlogReview(reviewId);

    return res.status(200).json({
      success: true,
      message: "Review unhidden successfully",
      data: review,
    });
  } catch (error) {
    console.error("Error unhiding blog review:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to unhide blog review",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Delete blog review (owner or admin)
export const deleteBlogReview = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "User not authenticated",
      });
    }

    // Get the review to check ownership
    const review = await blogReviewService.getBlogReviewById(reviewId);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
        data: null,
      });
    }

    // Check if user is owner or admin
    const isOwner = review.userId === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Permission denied",
        error: "You can only delete your own reviews",
      });
    }
    
    const deleted = await blogReviewService.deleteBlogReview(reviewId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
      data: null,
    });
  } catch (error) {
    console.error("Error deleting blog review:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete blog review",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Delete all reviews for a blog (admin only)
export const deleteAllReviewsByBlogId = async (req: Request, res: Response) => {
  try {
    const { blogId } = req.params;
    
    const deletedCount = await blogReviewService.deleteAllReviewsByBlogId(blogId);

    return res.status(200).json({
      success: true,
      message: `Successfully deleted ${deletedCount} review(s)`,
      data: { deletedCount },
    });
  } catch (error) {
    console.error("Error deleting all blog reviews:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete blog reviews",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Delete blog review reply
export const deleteBlogReviewReply = async (req: Request, res: Response) => {
  try {
    const { replyId } = req.params;
    
    const deleted = await blogReviewService.deleteBlogReviewReply(replyId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Reply not found",
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Reply deleted successfully",
      data: null,
    });
  } catch (error) {
    console.error("Error deleting blog review reply:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete blog review reply",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get blog review statistics
export const getBlogReviewStats = async (req: Request, res: Response) => {
  try {
    const { blogId } = req.query;
    
    const stats = await blogReviewService.getBlogReviewStats(blogId as string);

    return res.status(200).json({
      success: true,
      message: "Blog review statistics fetched successfully",
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching blog review statistics:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch blog review statistics",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
