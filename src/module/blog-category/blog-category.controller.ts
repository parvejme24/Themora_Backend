import { Request, Response } from "express";
import { blogCategoryService } from "./blog-category.service";
import { uploadBufferToCloudinary } from "../../middleware/cloudinary-upload";

export const getAllBlogCategories = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;

    const result = await blogCategoryService.getAllBlogCategories(page, limit, search);

    return res.status(200).json({
      success: true,
      message: "Blog categories fetched successfully",
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error fetching blog categories:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch blog categories",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getBlogCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const category = await blogCategoryService.getBlogCategoryById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Blog category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Blog category fetched successfully",
      data: category,
    });
  } catch (error) {
    console.error("Error fetching blog category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch blog category",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const createBlogCategory = async (req: Request, res: Response) => {
  try {
    console.log("req.body:", req.body);
    console.log("req.file:", (req as any).file);
    console.log("Content-Type:", req.headers['content-type']);
    
    // Handle both JSON and form-data
    let title, slug, imageUrl;
    
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      // Form data (from multer memory storage)
      title = req.body?.title;
      slug = req.body?.slug;
      
      // Upload file buffer to Cloudinary if file exists
      if ((req as any).file) {
        const uploaded = await uploadBufferToCloudinary((req as any).file, "themora/blog-categories");
        imageUrl = uploaded.url;
      }
    } else {
      // JSON data
      title = req.body?.title;
      slug = req.body?.slug;
      imageUrl = req.body?.imageUrl;
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Title is required",
        data: {
          receivedBody: req.body,
          receivedFile: (req as any).file ? "File received" : "No file"
        }
      });
    }

    // Prepare category data - always provide a slug
    let generatedSlug = slug;
    if (!generatedSlug || generatedSlug.trim() === '') {
      generatedSlug = title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }
    
    // Ensure we have a valid slug
    if (!generatedSlug || generatedSlug.trim() === '') {
      generatedSlug = 'untitled-' + Date.now();
    }
    
    console.log("Generated slug:", generatedSlug);
    console.log("Title:", title);
    console.log("ImageUrl:", imageUrl);
    
    const categoryData: any = { 
      title,
      slug: generatedSlug
    };
    
    console.log("Category data:", categoryData);

    const category = await blogCategoryService.createBlogCategory(
      categoryData,
      imageUrl
    );

    return res.status(201).json({
      success: true,
      message: "Blog category created successfully",
      data: category,
    });
  } catch (error) {
    console.error("Error creating blog category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create blog category",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateBlogCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Handle form data (title, slug, image)
    const title = req.body?.title;
    const slug = req.body?.slug;
    let imageUrl = req.body?.imageUrl;

    // Upload file buffer to Cloudinary if file exists
    if ((req as any).file) {
      const uploaded = await uploadBufferToCloudinary((req as any).file, "themora/blog-categories");
      imageUrl = uploaded.url;
    }

    // Only include fields that are provided
    const categoryData: any = {};
    if (title) categoryData.title = title;
    if (slug && slug.trim() !== '') categoryData.slug = slug;

    const category = await blogCategoryService.updateBlogCategory(
      id,
      categoryData,
      imageUrl
    );

    return res.status(200).json({
      success: true,
      message: "Blog category updated successfully",
      data: category,
    });
  } catch (error) {
    console.error("Error updating blog category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update blog category",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const deleteBlogCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await blogCategoryService.deleteBlogCategory(id);

    return res.status(200).json({
      success: true,
      message: "Blog category deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting blog category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete blog category",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
