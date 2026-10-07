import { Request, Response } from "express";
import { TemplateCategoryService } from "./template-category.service";
import { uploadBufferToCloudinary, getUploadedFile } from "../../middleware/cloudinary-upload";

const templateCategoryService = new TemplateCategoryService();

// Create template category
export const createTemplateCategory = async (req: Request, res: Response) => {
  try {
    const data = (req as any).validatedData || req.body;

    // Handle image upload from multer
    const file = getUploadedFile(req);
    if (file) {
      try {
        const uploadResult = await uploadBufferToCloudinary(
          file,
          "themora/template-categories"
        );
        data.image = uploadResult.url;
      } catch (uploadError: any) {
        console.error("Cloudinary upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload image to Cloudinary",
          error: uploadError.message,
        });
      }
    }

    const category = await templateCategoryService.createTemplateCategory(data);

    return res.status(201).json({
      success: true,
      message: "Template category created successfully",
      data: category,
    });
  } catch (error: any) {
    console.error("Error creating template category:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create template category",
    });
  }
};

// Get all template categories
export const getAllTemplateCategories = async (req: Request, res: Response) => {
  try {
    const query = (req as any).validatedQuery || req.query;
    const { page = 1, limit = 10, search, sortBy, sortOrder } = query;

    const result = await templateCategoryService.getAllTemplateCategories(
      page,
      limit,
      search,
      sortBy,
      sortOrder
    );

    return res.status(200).json({
      success: true,
      message: "Template categories fetched successfully",
      data: result.categories,
      pagination: result.pagination,
    });
  } catch (error: any) {
    console.error("Error fetching template categories:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch template categories",
      error: error.message,
    });
  }
};

// Get template category by ID
export const getTemplateCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const category = await templateCategoryService.getTemplateCategoryById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Template category not found",
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Template category fetched successfully",
      data: category,
    });
  } catch (error: any) {
    console.error("Error fetching template category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch template category",
      error: error.message,
    });
  }
};

// Update template category
export const updateTemplateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = (req as any).validatedData || req.body;

    // Handle image upload from multer
    const file = getUploadedFile(req);
    if (file) {
      try {
        const uploadResult = await uploadBufferToCloudinary(
          file,
          "themora/template-categories"
        );
        data.image = uploadResult.url;
      } catch (uploadError: any) {
        console.error("Cloudinary upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload image to Cloudinary",
          error: uploadError.message,
        });
      }
    }

    const category = await templateCategoryService.updateTemplateCategory(
      id,
      data
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Template category not found",
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Template category updated successfully",
      data: category,
    });
  } catch (error: any) {
    console.error("Error updating template category:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update template category",
    });
  }
};

// Delete template category
export const deleteTemplateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await templateCategoryService.deleteTemplateCategory(id);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    console.error("Error deleting template category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete template category",
      error: error.message,
    });
  }
};

// Get template category statistics
export const getTemplateCategoryStats = async (req: Request, res: Response) => {
  try {
    const stats = await templateCategoryService.getTemplateCategoryStats();

    return res.status(200).json({
      success: true,
      message: "Template category statistics fetched successfully",
      data: stats,
    });
  } catch (error: any) {
    console.error("Error fetching template category statistics:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch template category statistics",
      error: error.message,
    });
  }
};
