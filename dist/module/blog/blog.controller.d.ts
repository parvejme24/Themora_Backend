import { Request, Response } from "express";
export declare const getAllBlogs: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getBlogById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const addBlog: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const updateBlog: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const deleteBlog: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getBlogsByCategory: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getBlogsByAuthor: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getBlogStats: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const toggleBlogLike: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const togglePublish: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getPublishedBlogs: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getDraftBlogs: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const addBlogReaction: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getBlogReactions: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getUserReaction: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=blog.controller.d.ts.map