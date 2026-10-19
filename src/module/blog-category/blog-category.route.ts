import { Router } from "express";
import {
  getAllBlogCategories,
  getBlogCategoryById,
  createBlogCategory,
  updateBlogCategory,
  deleteBlogCategory,
} from "./blog-category.controller";
import { uploadImageMemory, handleUploadError } from "../../middleware/cloudinary-upload";

import { authorize } from "../../middleware/permissions";

const router = Router();

router.get("/blog-categories", getAllBlogCategories);
router.get("/blog-categories/:id", getBlogCategoryById);
router.post(
  "/blog-categories",
  authorize("marketing"),
  (req: any, res: any, next: any) => {
    (uploadImageMemory as any)(req, res, (err: any) => {
      if (err) return handleUploadError(err, req, res, next);
      return next();
    });
  },
  createBlogCategory
);
router.put(
  "/blog-categories/:id",
  authorize("marketing"),
  (req: any, res: any, next: any) => {
    (uploadImageMemory as any)(req, res, (err: any) => {
      if (err) return handleUploadError(err, req, res, next);
      return next();
    });
  },
  updateBlogCategory
);
router.delete("/blog-categories/:id", authorize("marketing"), deleteBlogCategory);

export default router;