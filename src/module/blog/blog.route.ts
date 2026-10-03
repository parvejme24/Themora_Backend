import { NextFunction, Request, Response, Router } from "express";
import {
  getAllBlogs,
  getBlogById,
  addBlog,
  updateBlog,
  deleteBlog,
  getBlogsByCategory,
  getBlogsByAuthor,
  getBlogStats,
  toggleBlogLike,
  getPublishedBlogs,
  getDraftBlogs,
  togglePublish,
  addBlogReaction,
  getBlogReactions,
  getUserReaction,
} from "./blog.controller";
import {
  validateBlogQuery,
  validateBlogId,
  validateCreateBlog,
  validateUpdateBlog,
  validateCategoryId,
  validateAuthorId,
  validateBlogLike,
  validateBlogReaction,
} from "./blog.validate";
import { uploadBlogImageCloudinary, handleUploadError } from "../../middleware/cloudinary-upload";
import { authenticateAdminAndCheckStatus, authenticateAndCheckStatus, optionalAuth } from "../../middleware/authMiddleware";

const router = Router();


// Get blogs
router.get("/blogs", optionalAuth, validateBlogQuery, getAllBlogs);
router.get("/blogs/published", validateBlogQuery, getPublishedBlogs);
router.get("/blogs/drafts", authenticateAdminAndCheckStatus, validateBlogQuery, getDraftBlogs);
router.get("/blogs/stats", authenticateAdminAndCheckStatus, getBlogStats);
router.get("/blogs/category/:categoryId", optionalAuth, validateCategoryId, validateBlogQuery, getBlogsByCategory);
router.get("/blogs/author/:authorId", optionalAuth, validateAuthorId, validateBlogQuery, getBlogsByAuthor);
router.get("/blogs/:id", optionalAuth, validateBlogId, getBlogById);

// Create/Update blogs
router.post("/blogs", authenticateAndCheckStatus, (req: Request, res: Response, next: NextFunction) => {
  (uploadBlogImageCloudinary as any)(req, res, (err: any) => {
    if (err) return handleUploadError(err, req, res, next);
    return next();
  });
}, validateCreateBlog, addBlog);
router.put("/blogs/:id", authenticateAndCheckStatus, validateBlogId, (req: Request, res: Response, next: NextFunction) => {
  (uploadBlogImageCloudinary as any)(req, res, (err: any) => {
    if (err) return handleUploadError(err, req, res, next);
    return next();
  });
}, validateUpdateBlog, updateBlog);
router.delete("/blogs/:id", authenticateAndCheckStatus, validateBlogId, deleteBlog);

// Blog likes
router.post("/blogs/:id/toggle-like", authenticateAndCheckStatus, validateBlogId, validateBlogLike, toggleBlogLike);

// Blog reactions
router.post("/blogs/:id/reactions", authenticateAndCheckStatus, validateBlogId, validateBlogReaction, addBlogReaction);
router.get("/blogs/:id/reactions", validateBlogId, getBlogReactions);
router.get("/blogs/:id/reactions/user", authenticateAndCheckStatus, validateBlogId, getUserReaction);

// Blog status management
router.patch("/blogs/:id/toggle-publish", authenticateAdminAndCheckStatus, validateBlogId, togglePublish);

export default router;