import { IBlog, ICreateBlog, IUpdateBlog, IBlogQuery, IBlogStats } from "./blog.interface";
export declare class BlogService {
    getAllBlogs(query: IBlogQuery): Promise<{
        blogs: IBlog[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    getBlogById(id: string): Promise<IBlog | null>;
    createBlog(data: ICreateBlog): Promise<IBlog>;
    updateBlog(id: string, data: IUpdateBlog): Promise<IBlog | null>;
    deleteBlog(id: string): Promise<boolean>;
    getBlogsByCategory(categoryId: string, query: IBlogQuery): Promise<{
        blogs: IBlog[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    getBlogsByAuthor(authorId: string, query: IBlogQuery): Promise<{
        blogs: IBlog[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    getBlogStats(): Promise<IBlogStats>;
    incrementViewCount(id: string, userId?: string): Promise<void>;
    toggleLike(blogId: string, userId: string): Promise<{
        liked: boolean;
        likes: number;
    }>;
    private getBlogLikesCount;
    addReaction(blogId: string, userId: string, reactionType: 'LIKE' | 'LOVE' | 'HAHA' | 'WOW' | 'SAD' | 'ANGRY'): Promise<{
        reaction: any;
        reactCount: number;
    }>;
    getBlogReactions(blogId: string): Promise<any[]>;
    getUserReaction(blogId: string, userId: string): Promise<any | null>;
    updateBlogStatus(id: string, isPublished: boolean): Promise<IBlog | null>;
    togglePublish(id: string): Promise<IBlog | null>;
    private updateCategoryBlogCount;
    private generateSlug;
    private generateUniqueSlug;
}
export declare const blogService: BlogService;
//# sourceMappingURL=blog.service.d.ts.map