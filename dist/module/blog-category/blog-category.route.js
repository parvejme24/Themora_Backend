"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const blog_category_controller_1 = require("./blog-category.controller");
const cloudinary_upload_1 = require("../../middleware/cloudinary-upload");
const authMiddleware_1 = require("../../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.get("/blog-categories", blog_category_controller_1.getAllBlogCategories);
router.get("/blog-categories/:id", blog_category_controller_1.getBlogCategoryById);
router.post("/blog-categories", authMiddleware_1.authenticateAdminAndCheckStatus, (req, res, next) => {
    cloudinary_upload_1.uploadImageMemory(req, res, (err) => {
        if (err)
            return (0, cloudinary_upload_1.handleUploadError)(err, req, res, next);
        return next();
    });
}, blog_category_controller_1.createBlogCategory);
router.put("/blog-categories/:id", authMiddleware_1.authenticateAdminAndCheckStatus, (req, res, next) => {
    cloudinary_upload_1.uploadImageMemory(req, res, (err) => {
        if (err)
            return (0, cloudinary_upload_1.handleUploadError)(err, req, res, next);
        return next();
    });
}, blog_category_controller_1.updateBlogCategory);
router.delete("/blog-categories/:id", authMiddleware_1.authenticateAdminAndCheckStatus, blog_category_controller_1.deleteBlogCategory);
exports.default = router;
//# sourceMappingURL=blog-category.route.js.map