import { Blog, BlogCategory, User, BlogLike, BlogReview, BlogReaction } from "@prisma/client";
export interface IBlogAuthor {
    id: string;
    fullName: string;
    email: string;
    profile?: {
        avatarUrl: string | null;
    } | null;
}
export interface IBlog extends Blog {
    author?: IBlogAuthor | User;
    category?: BlogCategory;
    blogLikes?: BlogLike[];
    reactions?: BlogReaction[];
    reviews?: BlogReview[];
}
export interface ICreateBlog {
    title: string;
    categoryId: string;
    featuredImageUrl?: string;
    description: string;
    readingTime: number;
    authorId: string;
    slug?: string;
    isPublished?: boolean;
    content?: any;
}
export interface IUpdateBlog {
    title?: string;
    categoryId?: string;
    featuredImageUrl?: string;
    description?: string;
    readingTime?: number;
    slug?: string;
    isPublished?: boolean;
    content?: any;
}
export interface IBlogQuery {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    authorId?: string;
    isPublished?: boolean;
    sortBy?: 'createdAt' | 'updatedAt' | 'reactCount' | 'viewCount' | 'readingTime';
    sortOrder?: 'asc' | 'desc';
}
export interface IBlogResponse {
    success: boolean;
    message: string;
    data?: IBlog | IBlog[] | null;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}
export interface IBlogStats {
    totalBlogs: number;
    publishedBlogs: number;
    draftBlogs: number;
    totalViews: number;
    totalLikes: number;
    totalReactions: number;
    averageReadingTime: number;
    blogsByCategory: Array<{
        categoryId: string;
        categoryName: string;
        count: number;
    }>;
    blogsByAuthor: Array<{
        authorId: string;
        authorName: string;
        count: number;
    }>;
}
export interface IBlogReaction {
    blogId: string;
    userId: string;
    reactionType: 'LIKE' | 'LOVE' | 'HAHA' | 'WOW' | 'SAD' | 'ANGRY';
}
//# sourceMappingURL=blog.interface.d.ts.map