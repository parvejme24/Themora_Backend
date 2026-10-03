import { prisma } from "../../config/database";
import { BlogCategory, PaginatedResult } from "./blog-category.type";
import { IBlogCategoryService } from "./blog-category.interface";

export class BlogCategoryService implements IBlogCategoryService {
  // Helper method to generate slug from title
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
  public async getAllBlogCategories(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<PaginatedResult<BlogCategory>> {
    const skip = (page - 1) * limit;
    
    const where = search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as any } },
            { slug: { contains: search, mode: "insensitive" as any } },
          ],
        }
      : {};

    const [total, items] = await Promise.all([
      prisma.blogCategory.count({ where }),
      prisma.blogCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items: items as unknown as BlogCategory[],
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

  public async getBlogCategoryById(id: string): Promise<BlogCategory | null> {
    const category = await prisma.blogCategory.findUnique({
      where: { id },
    });

    return category as unknown as BlogCategory | null;
  }

  public async createBlogCategory(
    data: { title: string; slug?: string | null },
    imageUrl?: string
  ): Promise<BlogCategory> {
    console.log("Service received data:", data);

    const payload: any = { 
      title: data.title,
      slug: data.slug
    };
    if (imageUrl) payload.imageUrl = imageUrl;

    console.log("Service payload:", payload);

    const created = await prisma.blogCategory.create({ data: payload });
    return created as unknown as BlogCategory;
  }

  public async updateBlogCategory(
    id: string,
    data: { title?: string; slug?: string | null },
    imageUrl?: string
  ): Promise<BlogCategory> {
    const payload: any = { ...data };
    
    // Auto-generate slug from title if title is provided but slug is not
    if (data.title && (!data.slug || data.slug.trim() === '')) {
      payload.slug = this.generateSlug(data.title);
    }
    
    if (imageUrl) payload.imageUrl = imageUrl;

    const updated = await prisma.blogCategory.update({ where: { id }, data: payload });
    return updated as unknown as BlogCategory;
  }

  public async deleteBlogCategory(id: string): Promise<void> {
    await prisma.blogCategory.delete({ where: { id } });
  }
}

export const blogCategoryService = new BlogCategoryService();
