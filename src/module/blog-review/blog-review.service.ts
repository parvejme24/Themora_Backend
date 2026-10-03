import { prisma } from "../../config/database";
import { IBlogReview, ICreateBlogReview, ICreateBlogReviewReply, IBlogReviewQuery, IBlogReviewStats, IUpdateBlogReview } from "./blog-review.interface";

export class BlogReviewService {
  // Create blog review
  public async createBlogReview(data: ICreateBlogReview): Promise<IBlogReview> {
    // Ensure blog exists to avoid FK violation
    const blogExists = await prisma.blog.findUnique({ where: { id: data.blogId } });
    if (!blogExists) {
      throw new Error("Blog not found for the provided blogId");
    }

    const createData: any = {
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

    return review as IBlogReview;
  }

  // Create blog review reply
  public async createBlogReviewReply(data: ICreateBlogReviewReply): Promise<any> {
    const createData: any = {
      replyText: data.replyText,
      review: { connect: { id: data.reviewId } },
    };
    // Connect required admin relation from controller-provided adminId
    createData.admin = { connect: { id: (data as any).adminId } };
    const reply = await prisma.blogReviewReply.create({ data: createData });

    return reply as any;
  }

  // Get blog reviews with pagination and filtering
  public async getBlogReviews(query: IBlogReviewQuery, isAdmin: boolean = false): Promise<{
    reviews: IBlogReview[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const { page = 1, limit = 10, blogId, userId, rating, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    
    const skip = (page - 1) * limit;
    
    // Build where clause
    const where: any = {};
    
    if (blogId) {
      where.blogId = blogId;
    }
    
    if (userId) {
      where.userId = userId;
    }
    
    if (rating) {
      where.rating = rating;
    }
    
    // Filter out hidden reviews for non-admin users
    if (!isAdmin) {
      where.isHidden = false;
    }
    
    // Build orderBy clause
    const orderBy: any = {};
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
        reviews: reviews as IBlogReview[],
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error: any) {
      // If isHidden field doesn't exist in database, retry without the filter
      if (error.message && (error.message.includes('isHidden') || error.message.includes('Unknown column'))) {
        console.warn('⚠️  isHidden field not found in database. Fetching without filter. Please run migration: npx prisma migrate dev');
        
        // Remove isHidden filter and retry
        const whereWithoutHidden: any = {};
        if (blogId) whereWithoutHidden.blogId = blogId;
        if (userId) whereWithoutHidden.userId = userId;
        if (rating) whereWithoutHidden.rating = rating;
        
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
          reviews: reviews as IBlogReview[],
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

  // Get blog review by ID
  public async getBlogReviewById(id: string): Promise<IBlogReview | null> {
    const review = await prisma.blogReview.findUnique({
      where: { id },
        include: { replies: true },
    });

    return review as IBlogReview | null;
  }

  // Get reviews by blog ID
  public async getReviewsByBlogId(blogId: string, query: IBlogReviewQuery, isAdmin: boolean = false): Promise<{
    reviews: IBlogReview[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    return this.getBlogReviews({ ...query, blogId }, isAdmin);
  }

  // Update blog review
  public async updateBlogReview(id: string, data: IUpdateBlogReview): Promise<IBlogReview> {
    const updateData: any = {};
    
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

    return review as IBlogReview;
  }

  // Hide blog review (admin only)
  public async hideBlogReview(id: string): Promise<IBlogReview> {
    try {
      const review = await prisma.blogReview.update({
        where: { id },
        data: { isHidden: true } as any,
        include: { replies: true },
      });

      return review as IBlogReview;
    } catch (error: any) {
      if (error.message && (error.message.includes('isHidden') || error.message.includes('Unknown column'))) {
        throw new Error('isHidden field does not exist in database. Please run migration: npx prisma migrate dev');
      }
      throw error;
    }
  }

  // Unhide blog review (admin only)
  public async unhideBlogReview(id: string): Promise<IBlogReview> {
    try {
      const review = await prisma.blogReview.update({
        where: { id },
        data: { isHidden: false } as any,
        include: { replies: true },
      });

      return review as IBlogReview;
    } catch (error: any) {
      if (error.message && (error.message.includes('isHidden') || error.message.includes('Unknown column'))) {
        throw new Error('isHidden field does not exist in database. Please run migration: npx prisma migrate dev');
      }
      throw error;
    }
  }

  // Delete all reviews for a blog (admin only)
  public async deleteAllReviewsByBlogId(blogId: string): Promise<number> {
    // First delete all replies for reviews of this blog
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

    // Then delete all reviews
    const result = await prisma.blogReview.deleteMany({
      where: { blogId },
    });

    return result.count;
  }

  // Update review approval status
  // Approval update removed to match Prisma model

  // Delete blog review
  public async deleteBlogReview(id: string): Promise<boolean> {
    try {
      // Delete all replies first
      await prisma.blogReviewReply.deleteMany({
        where: { reviewId: id },
      });

      // Delete the review
      await prisma.blogReview.delete({
        where: { id },
      });

      return true;
    } catch (error) {
      console.error("Error deleting blog review:", error);
      return false;
    }
  }

  // Delete blog review reply
  public async deleteBlogReviewReply(id: string): Promise<boolean> {
    try {
      await prisma.blogReviewReply.delete({
        where: { id },
      });

      return true;
    } catch (error) {
      console.error("Error deleting blog review reply:", error);
      return false;
    }
  }

  // Get blog review statistics
  public async getBlogReviewStats(blogId?: string): Promise<IBlogReviewStats> {
    const where = blogId ? { blogId } : {};

    const [
      totalReviews,
      averageRating,
      ratingDistribution,
      totalReplies,
    ] = await Promise.all([
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
      averageRating: (averageRating._avg?.rating as number) || 0,
      ratingDistribution: ratingDistribution.map(item => ({
        rating: item.rating as number,
        count: (item._count as any).id as number,
      })),
      totalReplies,
    };
  }

  // Check if user has already reviewed the blog
  public async hasUserReviewed(blogId: string, userId: string): Promise<boolean> {
    const existingReview = await prisma.blogReview.findFirst({
      where: {
        blogId,
        userId,
      },
    });

    return !!existingReview;
  }
}

export const blogReviewService = new BlogReviewService();
