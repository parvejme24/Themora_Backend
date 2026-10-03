"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const template_category_controller_1 = require("./template-category.controller");
const cloudinary_upload_1 = require("../../middleware/cloudinary-upload");
const authMiddleware_1 = require("../../middleware/authMiddleware");
const template_category_validate_1 = require("./template-category.validate");
const cache_1 = require("../../middleware/cache");
const router = (0, express_1.Router)();
router.get('/template-categories', (0, cache_1.cacheResponse)(60), template_category_validate_1.validateTemplateCategoryQuery, template_category_controller_1.getAllTemplateCategories);
router.get('/template-categories/stats', (0, cache_1.cacheResponse)(60), template_category_controller_1.getTemplateCategoryStats);
router.get('/template-categories/:id', (0, cache_1.cacheResponse)(60), template_category_validate_1.validateTemplateCategoryId, template_category_controller_1.getTemplateCategoryById);
router.post('/template-categories', authMiddleware_1.authenticateAdminAndCheckStatus, (req, res, next) => {
    if (req.headers['content-type']?.includes('multipart/form-data')) {
        cloudinary_upload_1.uploadCategoryImageCloudinary(req, res, (err) => {
            if (err)
                return (0, cloudinary_upload_1.handleUploadError)(err, req, res, next);
            return next();
        });
    }
    else {
        return next();
    }
}, template_category_validate_1.validateCreateTemplateCategory, template_category_controller_1.createTemplateCategory);
router.put('/template-categories/:id', authMiddleware_1.authenticateAdminAndCheckStatus, template_category_validate_1.validateTemplateCategoryId, (req, res, next) => {
    if (req.headers['content-type']?.includes('multipart/form-data')) {
        cloudinary_upload_1.uploadCategoryImageCloudinary(req, res, (err) => {
            if (err)
                return (0, cloudinary_upload_1.handleUploadError)(err, req, res, next);
            return next();
        });
    }
    else {
        return next();
    }
}, template_category_validate_1.validateUpdateTemplateCategory, template_category_controller_1.updateTemplateCategory);
router.delete('/template-categories/:id', authMiddleware_1.authenticateAdminAndCheckStatus, template_category_validate_1.validateTemplateCategoryId, template_category_controller_1.deleteTemplateCategory);
exports.default = router;
//# sourceMappingURL=template-category.route.js.map