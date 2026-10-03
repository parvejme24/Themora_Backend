"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blogReviewService = exports.BlogReviewService = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class BlogReviewService {
    async createBlogReview(data) {
        const blogExists = await prisma.blog.findUnique({ where: { id: data.blogId } });
        if (!blogExists) {
            throw new Error("Blog not found for the provided blogId");
        }
        const createData = {
            commentText: data.commentText,
            fullName: data.fullName,
            email: data.email,
            rating: data.rating ?? null,
            photoUrl: data.photoUrl ?? null,
            blog: { connect: { id: data.blogId } },
        };
        if (data.userId) {
            createData.user = { connect: { id: data.userId } };
        }
        const review = await prisma.blogReview.create({
            data: createData,
            include: { replies: true },
        });
        return review;
    }
    async createBlogReviewReply(data) {
        const createData = {
            replyText: data.replyText,
            review: { connect: { id: data.reviewId } },
        };
        createData.admin = { connect: { id: data.adminId } };
        const reply = await prisma.blogReviewReply.create({ data: createData });
        return reply;
    }
    async getBlogReviews(query, isAdmin = false) {
        const { page = 1, limit = 10, blogId, userId, rating, sortBy = 'createdAt', sortOrder = 'desc' } = query;
        const skip = (page - 1) * limit;
        const where = {};
        if (blogId) {
            where.blogId = blogId;
        }
        if (userId) {
            where.userId = userId;
        }
        if (rating) {
            where.rating = rating;
        }
        if (!isAdmin) {
            where.isHidden = false;
        }
        const orderBy = {};
        orderBy[sortBy] = sortOrder;
        try {
            const [reviews, total] = await Promise.all([
                prisma.blogReview.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy,
                    include: { replies: true },
                }),
                prisma.blogReview.count({ where }),
            ]);
            const totalPages = Math.ceil(total / limit);
            return {
                reviews: reviews,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages,
                    hasNext: page < totalPages,
                    hasPrev: page > 1,
                },
            };
        }
        catch (error) {
            if (error.message && (error.message.includes('isHidden') || error.message.includes('Unknown column'))) {
                console.warn('⚠️  isHidden field not found in database. Fetching without filter. Please run migration: npx prisma migrate dev');
                const whereWithoutHidden = {};
                if (blogId)
                    whereWithoutHidden.blogId = blogId;
                if (userId)
                    whereWithoutHidden.userId = userId;
                if (rating)
                    whereWithoutHidden.rating = rating;
                const [reviews, total] = await Promise.all([
                    prisma.blogReview.findMany({
                        where: whereWithoutHidden,
                        skip,
                        take: limit,
                        orderBy,
                        include: { replies: true },
                    }),
                    prisma.blogReview.count({ where: whereWithoutHidden }),
                ]);
                const totalPages = Math.ceil(total / limit);
                return {
                    reviews: reviews,
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages,
                        hasNext: page < totalPages,
                        hasPrev: page > 1,
                    },
                };
            }
            throw error;
        }
    }
    async getBlogReviewById(id) {
        const review = await prisma.blogReview.findUnique({
            where: { id },
            include: { replies: true },
        });
        return review;
    }
    async getReviewsByBlogId(blogId, query, isAdmin = false) {
        return this.getBlogReviews({ ...query, blogId }, isAdmin);
    }
    async updateBlogReview(id, data) {
        const updateData = {};
        if (data.rating !== undefined) {
            updateData.rating = data.rating;
        }
        if (data.commentText !== undefined) {
            updateData.commentText = data.commentText;
        }
        if (data.fullName !== undefined) {
            updateData.fullName = data.fullName;
        }
        if (data.email !== undefined) {
            updateData.email = data.email;
        }
        if (data.photoUrl !== undefined) {
            updateData.photoUrl = data.photoUrl;
        }
        const review = await prisma.blogReview.update({
            where: { id },
            data: updateData,
            include: { replies: true },
        });
        return review;
    }
    async hideBlogReview(id) {
        try {
            const review = await prisma.blogReview.update({
                where: { id },
                data: { isHidden: true },
                include: { replies: true },
            });
            return review;
        }
        catch (error) {
            if (error.message && (error.message.includes('isHidden') || error.message.includes('Unknown column'))) {
                throw new Error('isHidden field does not exist in database. Please run migration: npx prisma migrate dev');
            }
            throw error;
        }
    }
    async unhideBlogReview(id) {
        try {
            const review = await prisma.blogReview.update({
                where: { id },
                data: { isHidden: false },
                include: { replies: true },
            });
            return review;
        }
        catch (error) {
            if (error.message && (error.message.includes('isHidden') || error.message.includes('Unknown column'))) {
                throw new Error('isHidden field does not exist in database. Please run migration: npx prisma migrate dev');
            }
            throw error;
        }
    }
    async deleteAllReviewsByBlogId(blogId) {
        const reviews = await prisma.blogReview.findMany({
            where: { blogId },
            select: { id: true },
        });
        const reviewIds = reviews.map(r => r.id);
        if (reviewIds.length > 0) {
            await prisma.blogReviewReply.deleteMany({
                where: { reviewId: { in: reviewIds } },
            });
        }
        const result = await prisma.blogReview.deleteMany({
            where: { blogId },
        });
        return result.count;
    }
    async deleteBlogReview(id) {
        try {
            await prisma.blogReviewReply.deleteMany({
                where: { reviewId: id },
            });
            await prisma.blogReview.delete({
                where: { id },
            });
            return true;
        }
        catch (error) {
            console.error("Error deleting blog review:", error);
            return false;
        }
    }
    async deleteBlogReviewReply(id) {
        try {
            await prisma.blogReviewReply.delete({
                where: { id },
            });
            return true;
        }
        catch (error) {
            console.error("Error deleting blog review reply:", error);
            return false;
        }
    }
    async getBlogReviewStats(blogId) {
        const where = blogId ? { blogId } : {};
        const [totalReviews, averageRating, ratingDistribution, totalReplies,] = await Promise.all([
            prisma.blogReview.count({ where }),
            prisma.blogReview.aggregate({
                where,
                _avg: { rating: true },
            }),
            prisma.blogReview.groupBy({
                by: ['rating'],
                where,
                _count: { id: true },
            }),
            prisma.blogReviewReply.count({
                where: blogId ? { review: { blogId } } : {},
            }),
        ]);
        return {
            totalReviews,
            averageRating: averageRating._avg?.rating || 0,
            ratingDistribution: ratingDistribution.map(item => ({
                rating: item.rating,
                count: item._count.id,
            })),
            totalReplies,
        };
    }
    async hasUserReviewed(blogId, userId) {
        const existingReview = await prisma.blogReview.findFirst({
            where: {
                blogId,
                userId,
            },
        });
        return !!existingReview;
    }
}
exports.BlogReviewService = BlogReviewService;
exports.blogReviewService = new BlogReviewService();
//# sourceMappingURL=blog-review.service.js.map