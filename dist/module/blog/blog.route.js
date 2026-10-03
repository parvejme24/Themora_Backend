"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const blog_controller_1 = require("./blog.controller");
const blog_validate_1 = require("./blog.validate");
const cloudinary_upload_1 = require("../../middleware/cloudinary-upload");
const authMiddleware_1 = require("../../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.get("/blogs", authMiddleware_1.optionalAuth, blog_validate_1.validateBlogQuery, blog_controller_1.getAllBlogs);
router.get("/blogs/published", blog_validate_1.validateBlogQuery, blog_controller_1.getPublishedBlogs);
router.get("/blogs/drafts", authMiddleware_1.authenticateAdminAndCheckStatus, blog_validate_1.validateBlogQuery, blog_controller_1.getDraftBlogs);
router.get("/blogs/stats", authMiddleware_1.authenticateAdminAndCheckStatus, blog_controller_1.getBlogStats);
router.get("/blogs/category/:categoryId", authMiddleware_1.optionalAuth, blog_validate_1.validateCategoryId, blog_validate_1.validateBlogQuery, blog_controller_1.getBlogsByCategory);
router.get("/blogs/author/:authorId", authMiddleware_1.optionalAuth, blog_validate_1.validateAuthorId, blog_validate_1.validateBlogQuery, blog_controller_1.getBlogsByAuthor);
router.get("/blogs/:id", authMiddleware_1.optionalAuth, blog_validate_1.validateBlogId, blog_controller_1.getBlogById);
router.post("/blogs", authMiddleware_1.authenticateAndCheckStatus, (req, res, next) => {
    cloudinary_upload_1.uploadBlogImageCloudinary(req, res, (err) => {
        if (err)
            return (0, cloudinary_upload_1.handleUploadError)(err, req, res, next);
        return next();
    });
}, blog_validate_1.validateCreateBlog, blog_controller_1.addBlog);
router.put("/blogs/:id", authMiddleware_1.authenticateAndCheckStatus, blog_validate_1.validateBlogId, (req, res, next) => {
    cloudinary_upload_1.uploadBlogImageCloudinary(req, res, (err) => {
        if (err)
            return (0, cloudinary_upload_1.handleUploadError)(err, req, res, next);
        return next();
    });
}, blog_validate_1.validateUpdateBlog, blog_controller_1.updateBlog);
router.delete("/blogs/:id", authMiddleware_1.authenticateAndCheckStatus, blog_validate_1.validateBlogId, blog_controller_1.deleteBlog);
router.post("/blogs/:id/toggle-like", authMiddleware_1.authenticateAndCheckStatus, blog_validate_1.validateBlogId, blog_validate_1.validateBlogLike, blog_controller_1.toggleBlogLike);
router.post("/blogs/:id/reactions", authMiddleware_1.authenticateAndCheckStatus, blog_validate_1.validateBlogId, blog_validate_1.validateBlogReaction, blog_controller_1.addBlogReaction);
router.get("/blogs/:id/reactions", blog_validate_1.validateBlogId, blog_controller_1.getBlogReactions);
router.get("/blogs/:id/reactions/user", authMiddleware_1.authenticateAndCheckStatus, blog_validate_1.validateBlogId, blog_controller_1.getUserReaction);
router.patch("/blogs/:id/toggle-publish", authMiddleware_1.authenticateAdminAndCheckStatus, blog_validate_1.validateBlogId, blog_controller_1.togglePublish);
exports.default = router;
//# sourceMappingURL=blog.route.js.map