import { prisma } from "../../config/database";
import { IBlog, ICreateBlog, IUpdateBlog, IBlogQuery, IBlogStats } from "./blog.interface";

export class BlogService {
  // Get all blogs with pagination and filtering
  public async getAllBlogs(query: IBlogQuery): Promise<{
    blogs: IBlog[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const { page = 1, limit = 10, search, categoryId, authorId, isPublished, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    
    const skip = (page - 1) * limit;
    
    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (categoryId) {
      where.categoryId = categoryId;
    }
    
    if (authorId) {
      where.authorId = authorId;
    }
    
    if (typeof isPublished === 'boolean') {
      where.isPublished = isPublished;
    }
    
    // Build orderBy clause
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;
    
    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
              email: true,
              profile: {
                select: {
                  avatarUrl: true,
                },
              },
            },
          },
          category: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
          blogLikes: {
            select: {
              id: true,
              userId: true,
            },
          },
          reactions: {
            select: {
              id: true,
              userId: true,
              reactionType: true,
            },
          },
          reviews: {
            select: {
              id: true,
              rating: true,
            },
          },
        },
      }),
      prisma.blog.count({ where }),
    ]);
    
    const totalPages = Math.ceil(total / limit);
    
    return {
      blogs: blogs as IBlog[],
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
  
  // Get blog by ID
  public async getBlogById(id: string): Promise<IBlog | null> {
    const blog = await prisma.blog.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profile: {
              select: {
                avatarUrl: true,
              },
            },
          },
        },
        category: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        blogLikes: {
          select: {
            id: true,
            userId: true,
          },
        },
        reactions: {
          select: {
            id: true,
            userId: true,
            reactionType: true,
            createdAt: true,
          },
        },
        reviews: {
          select: {
            id: true,
            rating: true,
            commentText: true,
            fullName: true,
            createdAt: true,
          },
        },
      },
    });
    
    return blog as IBlog | null;
  }
  
  // Create new blog
  public async createBlog(data: ICreateBlog): Promise<IBlog> {
    // Generate slug if not provided
    let slug = data.slug;
    if (!slug || slug.trim() === '') {
      slug = await this.generateUniqueSlug(data.title);
    } else {
      // Check if provided slug is unique
      slug = await this.generateUniqueSlug(slug);
    }
    
    const blog = await prisma.blog.create({
      data: {
        ...data,
        slug,
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profile: {
              select: {
                avatarUrl: true,
              },
            },
          },
        },
        category: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });
    
    // Update category blog count
    await this.updateCategoryBlogCount(data.categoryId);
    
    return blog as IBlog;
  }
  
  // Update blog
  public async updateBlog(id: string, data: IUpdateBlog): Promise<IBlog | null> {
    const existingBlog = await prisma.blog.findUnique({
      where: { id },
      select: { categoryId: true, slug: true },
    });
    
    if (!existingBlog) {
      return null;
    }
    
    // Generate unique slug if title is provided but slug is not, or if slug is being updated
    let updateData = { ...data };
    if (data.title && (!data.slug || data.slug.trim() === '')) {
      updateData.slug = await this.generateUniqueSlug(data.title);
    } else if (data.slug && data.slug !== existingBlog.slug) {
      // If slug is being changed, ensure it's unique
      updateData.slug = await this.generateUniqueSlug(data.slug);
    }
    
    const blog = await prisma.blog.update({
      where: { id },
      data: updateData,
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profile: {
              select: {
                avatarUrl: true,
              },
            },
          },
        },
        category: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });
    
    // Update category blog count if category changed
    if (data.categoryId && data.categoryId !== existingBlog.categoryId) {
      await Promise.all([
        this.updateCategoryBlogCount(existingBlog.categoryId),
        this.updateCategoryBlogCount(data.categoryId),
      ]);
    }
    
    return blog as IBlog;
  }
  
  // Delete blog
  public async deleteBlog(id: string): Promise<boolean> {
    const existingBlog = await prisma.blog.findUnique({
      where: { id },
      select: { categoryId: true },
    });
    
    if (!existingBlog) {
      return false;
    }
    
    await prisma.blog.delete({
      where: { id },
    });
    
    // Update category blog count
    await this.updateCategoryBlogCount(existingBlog.categoryId);
    
    return true;
  }
  
  // Get blogs by category
  public async getBlogsByCategory(categoryId: string, query: IBlogQuery): Promise<{
    blogs: IBlog[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    return this.getAllBlogs({ ...query, categoryId });
  }
  
  // Get blogs by author
  public async getBlogsByAuthor(authorId: string, query: IBlogQuery): Promise<{
    blogs: IBlog[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    return this.getAllBlogs({ ...query, authorId });
  }
  
  // Get blog statistics
  public async getBlogStats(): Promise<IBlogStats> {
    const [
      totalBlogs,
      publishedBlogs,
      draftBlogs,
      totalViews,
      totalLikes,
      averageReadingTime,
      blogsByCategory,
      blogsByAuthor,
    ] = await Promise.all([
      prisma.blog.count(),
      prisma.blog.count({ where: { isPublished: true } }),
      prisma.blog.count({ where: { isPublished: false } }),
      prisma.blog.aggregate({
        _sum: { viewCount: true },
      }),
      prisma.blog.aggregate({
        _sum: { reactCount: true },
      }),
      prisma.blog.aggregate({
        _avg: { readingTime: true },
      }),
      prisma.blog.groupBy({
        by: ['categoryId'],
        _count: { id: true },
      }),
      prisma.blog.groupBy({
        by: ['authorId'],
        _count: { id: true },
      }),
    ]);
    
    return {
      totalBlogs,
      publishedBlogs,
      draftBlogs,
      totalViews: totalViews._sum.viewCount || 0,
      totalLikes: totalLikes._sum.reactCount || 0,
      totalReactions: totalLikes._sum.reactCount || 0,
      averageReadingTime: averageReadingTime._avg.readingTime || 0,
      blogsByCategory: blogsByCategory.map(item => ({
        categoryId: item.categoryId,
        categoryName: 'Unknown', // Will be populated separately if needed
        count: item._count.id,
      })),
      blogsByAuthor: blogsByAuthor.map(item => ({
        authorId: item.authorId,
        authorName: 'Unknown', // Will be populated separately if needed
        count: item._count.id,
      })),
    };
  }
  
  // Increment view count (only for logged-in users)
  public async incrementViewCount(id: string, userId?: string): Promise<void> {
    // Only increment if user is logged in (userId provided)
    if (!userId) {
      return;
    }
    
    await prisma.blog.update({
      where: { id },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    });
  }
  
  // Toggle like (legacy - kept for backward compatibility)
  // Note: This uses BlogLike model, which is separate from BlogReaction
  // For new features, use addReaction instead
  public async toggleLike(blogId: string, userId: string): Promise<{ liked: boolean; likes: number }> {
    const existingLike = await prisma.blogLike.findUnique({
      where: {
        blogId_userId: {
          blogId,
          userId,
        },
      },
    });
    
    if (existingLike) {
      // Unlike
      await prisma.blogLike.delete({
        where: {
          blogId_userId: {
            blogId,
            userId,
          },
        },
      });
      
      // Get current like count
      const likeCount = await prisma.blogLike.count({
        where: { blogId },
      });
      
      return { liked: false, likes: likeCount };
    } else {
      // Like
      await prisma.blogLike.create({
        data: {
          blogId,
          userId,
        },
      });
      
      // Get current like count
      const likeCount = await prisma.blogLike.count({
        where: { blogId },
      });
      
      return { liked: true, likes: likeCount };
    }
  }
  
  // Get blog likes count (legacy - counts BlogLike records)
  private async getBlogLikesCount(blogId: string): Promise<number> {
    const count = await prisma.blogLike.count({
      where: { blogId },
    });
    
    return count;
  }

  // Add or update reaction
  public async addReaction(blogId: string, userId: string, reactionType: 'LIKE' | 'LOVE' | 'HAHA' | 'WOW' | 'SAD' | 'ANGRY'): Promise<{ reaction: any; reactCount: number }> {
    const existingReaction = await prisma.blogReaction.findUnique({
      where: {
        blogId_userId: {
          blogId,
          userId,
        },
      },
    });

    if (existingReaction) {
      // Update existing reaction
      if (existingReaction.reactionType === reactionType) {
        // Same reaction, remove it
        await prisma.blogReaction.delete({
          where: {
            blogId_userId: {
              blogId,
              userId,
            },
          },
        });
        
        // Decrement react count
        await prisma.blog.update({
          where: { id: blogId },
          data: {
            reactCount: {
              decrement: 1,
            },
          },
        });
        
        const updatedBlog = await prisma.blog.findUnique({
          where: { id: blogId },
          select: { reactCount: true },
        });
        
        return { reaction: null, reactCount: updatedBlog?.reactCount || 0 };
      } else {
        // Different reaction, update it
        await prisma.blogReaction.update({
          where: {
            blogId_userId: {
              blogId,
              userId,
            },
          },
          data: {
            reactionType,
          },
        });
        
        // Count stays the same (just changed type)
        const updatedBlog = await prisma.blog.findUnique({
          where: { id: blogId },
          select: { reactCount: true },
        });
        
        const reaction = await prisma.blogReaction.findUnique({
          where: {
            blogId_userId: {
              blogId,
              userId,
            },
          },
        });
        
        return { reaction, reactCount: updatedBlog?.reactCount || 0 };
      }
    } else {
      // Create new reaction
      await prisma.blogReaction.create({
        data: {
          blogId,
          userId,
          reactionType,
        },
      });
      
      // Increment react count
      await prisma.blog.update({
        where: { id: blogId },
        data: {
          reactCount: {
            increment: 1,
          },
        },
      });
      
      const updatedBlog = await prisma.blog.findUnique({
        where: { id: blogId },
        select: { reactCount: true },
      });
      
      const reaction = await prisma.blogReaction.findUnique({
        where: {
          blogId_userId: {
            blogId,
            userId,
          },
        },
      });
      
      return { reaction, reactCount: updatedBlog?.reactCount || 0 };
    }
  }

  // Get reactions for a blog
  public async getBlogReactions(blogId: string): Promise<any[]> {
    const reactions = await prisma.blogReaction.findMany({
      where: { blogId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profile: {
              select: {
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    return reactions;
  }

  // Get user's reaction for a blog
  public async getUserReaction(blogId: string, userId: string): Promise<any | null> {
    const reaction = await prisma.blogReaction.findUnique({
      where: {
        blogId_userId: {
          blogId,
          userId,
        },
      },
    });
    
    return reaction;
  }
  
  // Update blog publish status
  public async updateBlogStatus(id: string, isPublished: boolean): Promise<IBlog | null> {
    const blog = await prisma.blog.update({
      where: { id },
      data: { isPublished },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profile: {
              select: {
                avatarUrl: true,
              },
            },
          },
        },
        category: {
          select: { id: true, title: true, slug: true },
        },
      },
    });
    return blog as IBlog;
  }

  // Toggle blog publish status
  public async togglePublish(id: string): Promise<IBlog | null> {
    const existing = await prisma.blog.findUnique({ where: { id }, select: { isPublished: true } });
    if (!existing) {
      return null;
    }
    const blog = await prisma.blog.update({
      where: { id },
      data: { isPublished: !existing.isPublished },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profile: {
              select: {
                avatarUrl: true,
              },
            },
          },
        },
        category: { select: { id: true, title: true, slug: true } },
      },
    });
    return blog as IBlog;
  }

  // Update category blog count
  private async updateCategoryBlogCount(categoryId: string): Promise<void> {
    const count = await prisma.blog.count({
      where: { categoryId },
    });
    
    await prisma.blogCategory.update({
      where: { id: categoryId },
      data: { blogCount: count },
    });
  }
  
  // Generate slug from title
  private generateSlug(title: string): string {
    const slug = title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    
    // Ensure we have a valid slug
    return slug || 'untitled-' + Date.now();
  }

  // Generate unique slug by checking database
  private async generateUniqueSlug(baseSlug: string): Promise<string> {
    const baseSlugGenerated = this.generateSlug(baseSlug);
    let slug = baseSlugGenerated;
    let counter = 1;

    // Check if slug exists and generate unique one
    while (true) {
      const existingBlog = await prisma.blog.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existingBlog) {
        // Slug is unique, we can use it
        break;
      }

      // Slug exists, try with counter
      slug = `${baseSlugGenerated}-${counter}`;
      counter++;
    }

    return slug;
  }
}

export const blogService = new BlogService();
