"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlogReviewStats = exports.deleteBlogReviewReply = exports.deleteAllReviewsByBlogId = exports.deleteBlogReview = exports.unhideBlogReview = exports.hideBlogReview = exports.updateBlogReview = exports.getBlogReviewById = exports.getReviewsByBlogId = exports.getBlogReviews = exports.createBlogReviewReply = exports.createBlogReview = void 0;
const blog_review_service_1 = require("./blog-review.service");
const createBlogReview = async (req, res) => {
    try {
        const { blogId } = req.params;
        const user = req.user;
        const reviewData = {
            ...req.body,
            blogId,
            userId: user.id,
            fullName: user.fullName,
            email: user.email,
        };
        const hasReviewed = await blog_review_service_1.blogReviewService.hasUserReviewed(blogId, user.id);
        if (hasReviewed) {
            return res.status(400).json({
                success: false,
                message: "You have already reviewed this blog",
                error: "Duplicate review not allowed"
            });
        }
        const review = await blog_review_service_1.blogReviewService.createBlogReview(reviewData);
        return res.status(201).json({
            success: true,
            message: "Review submitted successfully.",
            data: review,
        });
    }
    catch (error) {
        console.error("Error creating blog review:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create blog review",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.createBlogReview = createBlogReview;
const createBlogReviewReply = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const adminId = req.user?.id;
        if (!adminId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
                error: "Admin user not found in context",
            });
        }
        const replyData = { ...req.body, reviewId, adminId };
        const reply = await blog_review_service_1.blogReviewService.createBlogReviewReply(replyData);
        return res.status(201).json({
            success: true,
            message: "Reply submitted successfully.",
            data: reply,
        });
    }
    catch (error) {
        console.error("Error creating blog review reply:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create blog review reply",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.createBlogReviewReply = createBlogReviewReply;
const getBlogReviews = async (req, res) => {
    try {
        const query = req.validatedQuery || req.query;
        const user = req.user;
        const isAdmin = user?.role === 'ADMIN';
        const result = await blog_review_service_1.blogReviewService.getBlogReviews(query, isAdmin);
        return res.status(200).json({
            success: true,
            message: "Blog reviews fetched successfully",
            data: result.reviews,
            pagination: result.pagination,
        });
    }
    catch (error) {
        console.error("Error fetching blog reviews:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch blog reviews",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getBlogReviews = getBlogReviews;
const getReviewsByBlogId = async (req, res) => {
    try {
        const { blogId } = req.params;
        const query = req.validatedQuery || req.query;
        const user = req.user;
        const isAdmin = user?.role === 'ADMIN';
        const result = await blog_review_service_1.blogReviewService.getReviewsByBlogId(blogId, query, isAdmin);
        return res.status(200).json({
            success: true,
            message: "Blog reviews fetched successfully",
            data: result.reviews,
            pagination: result.pagination,
        });
    }
    catch (error) {
        console.error("Error fetching blog reviews:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch blog reviews",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getReviewsByBlogId = getReviewsByBlogId;
const getBlogReviewById = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const user = req.user;
        const isAdmin = user?.role === 'ADMIN';
        const review = await blog_review_service_1.blogReviewService.getBlogReviewById(reviewId);
        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Review not found",
                data: null,
            });
        }
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
    }
    catch (error) {
        console.error("Error fetching blog review:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch blog review",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getBlogReviewById = getBlogReviewById;
const updateBlogReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const user = req.user;
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
                error: "User not authenticated",
            });
        }
        const review = await blog_review_service_1.blogReviewService.getBlogReviewById(reviewId);
        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Review not found",
                data: null,
            });
        }
        const isOwner = review.userId === user.id;
        const isAdmin = user.role === 'ADMIN';
        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: "Permission denied",
                error: "You can only update your own reviews",
            });
        }
        const updatedReview = await blog_review_service_1.blogReviewService.updateBlogReview(reviewId, req.body);
        return res.status(200).json({
            success: true,
            message: "Review updated successfully",
            data: updatedReview,
        });
    }
    catch (error) {
        console.error("Error updating blog review:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update blog review",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.updateBlogReview = updateBlogReview;
const hideBlogReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const review = await blog_review_service_1.blogReviewService.hideBlogReview(reviewId);
        return res.status(200).json({
            success: true,
            message: "Review hidden successfully",
            data: review,
        });
    }
    catch (error) {
        console.error("Error hiding blog review:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to hide blog review",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.hideBlogReview = hideBlogReview;
const unhideBlogReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const review = await blog_review_service_1.blogReviewService.unhideBlogReview(reviewId);
        return res.status(200).json({
            success: true,
            message: "Review unhidden successfully",
            data: review,
        });
    }
    catch (error) {
        console.error("Error unhiding blog review:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to unhide blog review",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.unhideBlogReview = unhideBlogReview;
const deleteBlogReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const user = req.user;
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
                error: "User not authenticated",
            });
        }
        const review = await blog_review_service_1.blogReviewService.getBlogReviewById(reviewId);
        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Review not found",
                data: null,
            });
        }
        const isOwner = review.userId === user.id;
        const isAdmin = user.role === 'ADMIN';
        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: "Permission denied",
                error: "You can only delete your own reviews",
            });
        }
        const deleted = await blog_review_service_1.blogReviewService.deleteBlogReview(reviewId);
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
    }
    catch (error) {
        console.error("Error deleting blog review:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete blog review",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.deleteBlogReview = deleteBlogReview;
const deleteAllReviewsByBlogId = async (req, res) => {
    try {
        const { blogId } = req.params;
        const deletedCount = await blog_review_service_1.blogReviewService.deleteAllReviewsByBlogId(blogId);
        return res.status(200).json({
            success: true,
            message: `Successfully deleted ${deletedCount} review(s)`,
            data: { deletedCount },
        });
    }
    catch (error) {
        console.error("Error deleting all blog reviews:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete blog reviews",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.deleteAllReviewsByBlogId = deleteAllReviewsByBlogId;
const deleteBlogReviewReply = async (req, res) => {
    try {
        const { replyId } = req.params;
        const deleted = await blog_review_service_1.blogReviewService.deleteBlogReviewReply(replyId);
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
    }
    catch (error) {
        console.error("Error deleting blog review reply:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete blog review reply",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.deleteBlogReviewReply = deleteBlogReviewReply;
const getBlogReviewStats = async (req, res) => {
    try {
        const { blogId } = req.query;
        const stats = await blog_review_service_1.blogReviewService.getBlogReviewStats(blogId);
        return res.status(200).json({
            success: true,
            message: "Blog review statistics fetched successfully",
            data: stats,
        });
    }
    catch (error) {
        console.error("Error fetching blog review statistics:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch blog review statistics",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getBlogReviewStats = getBlogReviewStats;
//# sourceMappingURL=blog-review.controller.js.map