"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const template_controller_1 = require("./template.controller");
const cloudinary_upload_1 = require("../../middleware/cloudinary-upload");
const authMiddleware_1 = require("../../middleware/authMiddleware");
const template_validate_1 = require("./template.validate");
const cache_1 = require("../../middleware/cache");
const router = (0, express_1.Router)();
router.get('/templates', (0, cache_1.cacheResponse)(30), authMiddleware_1.optionalAuth, template_validate_1.validateTemplateQuery, template_controller_1.getAllTemplates);
router.get('/templates/new-arrivals', (0, cache_1.cacheResponse)(30), authMiddleware_1.optionalAuth, template_validate_1.validateNewArrivalsQuery, template_controller_1.getNewArrivals);
router.get('/templates/stats', (0, cache_1.cacheResponse)(60), template_controller_1.getTemplateStats);
router.get('/templates/:id', (0, cache_1.cacheResponse)(30), authMiddleware_1.optionalAuth, template_validate_1.validateTemplateId, template_controller_1.getTemplateById);
router.post('/templates', authMiddleware_1.authenticateAdminAndCheckStatus, (req, res, next) => {
    if (req.headers['content-type']?.includes('multipart/form-data')) {
        cloudinary_upload_1.uploadTemplateImageCloudinary(req, res, (err) => {
            if (err)
                return (0, cloudinary_upload_1.handleUploadError)(err, req, res, next);
            return next();
        });
    }
    else {
        return next();
    }
}, template_validate_1.validateCreateTemplate, template_controller_1.createTemplate);
router.put('/templates/:id', authMiddleware_1.authenticateAdminAndCheckStatus, template_validate_1.validateTemplateId, (req, res, next) => {
    if (req.headers['content-type']?.includes('multipart/form-data')) {
        cloudinary_upload_1.uploadTemplateImageCloudinary(req, res, (err) => {
            if (err)
                return (0, cloudinary_upload_1.handleUploadError)(err, req, res, next);
            return next();
        });
    }
    else {
        return next();
    }
}, template_validate_1.validateUpdateTemplate, template_controller_1.updateTemplate);
router.delete('/templates/:id', authMiddleware_1.authenticateAdminAndCheckStatus, template_validate_1.validateTemplateId, template_controller_1.deleteTemplate);
router.get('/templates/:templateId/download/:fileIndex', authMiddleware_1.authenticateAndCheckStatus, template_controller_1.downloadSourceFile);
exports.default = router;
//# sourceMappingURL=template.route.js.map