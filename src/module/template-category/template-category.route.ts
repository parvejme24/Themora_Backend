import { Router } from 'express';
import {
  getAllTemplateCategories,
  getTemplateCategoryById,
  createTemplateCategory,
  updateTemplateCategory,
  deleteTemplateCategory,
  getTemplateCategoryStats,
} from './template-category.controller';
import { uploadCategoryImageCloudinary, handleUploadError } from '../../middleware/cloudinary-upload';
import { authenticateAdminAndCheckStatus } from '../../middleware/authMiddleware';
import {
  validateCreateTemplateCategory,
  validateUpdateTemplateCategory,
  validateTemplateCategoryId,
  validateTemplateCategoryQuery,
} from './template-category.validate';

import { cacheResponse } from '../../middleware/cache';

const router = Router();

// Public routes (cached for high performance)
router.get('/template-categories', cacheResponse(60), validateTemplateCategoryQuery, getAllTemplateCategories);
router.get('/template-categories/stats', cacheResponse(60), getTemplateCategoryStats);
router.get('/template-categories/:id', cacheResponse(60), validateTemplateCategoryId, getTemplateCategoryById);

// Admin routes
router.post('/template-categories', authenticateAdminAndCheckStatus, (req: any, res: any, next: any) => {
  // Check if there's a file upload
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    (uploadCategoryImageCloudinary as any)(req, res, (err: any) => {
      if (err) return handleUploadError(err, req, res, next);
      return next();
    });
  } else {
    // No file upload, proceed directly
    return next();
  }
}, validateCreateTemplateCategory, createTemplateCategory);

router.put('/template-categories/:id', authenticateAdminAndCheckStatus, validateTemplateCategoryId, (req: any, res: any, next: any) => {
  // Check if there's a file upload
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    (uploadCategoryImageCloudinary as any)(req, res, (err: any) => {
      if (err) return handleUploadError(err, req, res, next);
      return next();
    });
  } else {
    // No file upload, proceed directly
    return next();
  }
}, validateUpdateTemplateCategory, updateTemplateCategory);

router.delete('/template-categories/:id', authenticateAdminAndCheckStatus, validateTemplateCategoryId, deleteTemplateCategory);

export default router;
