import { Request, Response } from "express";
export declare const createBlogReview: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const createBlogReviewReply: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getBlogReviews: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getReviewsByBlogId: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getBlogReviewById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const updateBlogReview: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const hideBlogReview: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const unhideBlogReview: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const deleteBlogReview: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const deleteAllReviewsByBlogId: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const deleteBlogReviewReply: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getBlogReviewStats: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=blog-review.controller.d.ts.map