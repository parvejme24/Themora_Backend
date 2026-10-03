"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBlogCategory = exports.updateBlogCategory = exports.createBlogCategory = exports.getBlogCategoryById = exports.getAllBlogCategories = void 0;
const blog_category_service_1 = require("./blog-category.service");
const cloudinary_upload_1 = require("../../middleware/cloudinary-upload");
const getAllBlogCategories = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search;
        const result = await blog_category_service_1.blogCategoryService.getAllBlogCategories(page, limit, search);
        return res.status(200).json({
            success: true,
            message: "Blog categories fetched successfully",
            data: result.items,
            pagination: result.pagination,
        });
    }
    catch (error) {
        console.error("Error fetching blog categories:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch blog categories",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getAllBlogCategories = getAllBlogCategories;
const getBlogCategoryById = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await blog_category_service_1.blogCategoryService.getBlogCategoryById(id);
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
    }
    catch (error) {
        console.error("Error fetching blog category:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch blog category",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getBlogCategoryById = getBlogCategoryById;
const createBlogCategory = async (req, res) => {
    try {
        console.log("req.body:", req.body);
        console.log("req.file:", req.file);
        console.log("Content-Type:", req.headers['content-type']);
        let title, slug, imageUrl;
        if (req.headers['content-type']?.includes('multipart/form-data')) {
            title = req.body?.title;
            slug = req.body?.slug;
            if (req.file) {
                const uploaded = await (0, cloudinary_upload_1.uploadBufferToCloudinary)(req.file, "themora/blog-categories");
                imageUrl = uploaded.url;
            }
        }
        else {
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
                    receivedFile: req.file ? "File received" : "No file"
                }
            });
        }
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
        if (!generatedSlug || generatedSlug.trim() === '') {
            generatedSlug = 'untitled-' + Date.now();
        }
        console.log("Generated slug:", generatedSlug);
        console.log("Title:", title);
        console.log("ImageUrl:", imageUrl);
        const categoryData = {
            title,
            slug: generatedSlug
        };
        console.log("Category data:", categoryData);
        const category = await blog_category_service_1.blogCategoryService.createBlogCategory(categoryData, imageUrl);
        return res.status(201).json({
            success: true,
            message: "Blog category created successfully",
            data: category,
        });
    }
    catch (error) {
        console.error("Error creating blog category:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create blog category",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.createBlogCategory = createBlogCategory;
const updateBlogCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const title = req.body?.title;
        const slug = req.body?.slug;
        let imageUrl = req.body?.imageUrl;
        if (req.file) {
            const uploaded = await (0, cloudinary_upload_1.uploadBufferToCloudinary)(req.file, "themora/blog-categories");
            imageUrl = uploaded.url;
        }
        const categoryData = {};
        if (title)
            categoryData.title = title;
        if (slug && slug.trim() !== '')
            categoryData.slug = slug;
        const category = await blog_category_service_1.blogCategoryService.updateBlogCategory(id, categoryData, imageUrl);
        return res.status(200).json({
            success: true,
            message: "Blog category updated successfully",
            data: category,
        });
    }
    catch (error) {
        console.error("Error updating blog category:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update blog category",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.updateBlogCategory = updateBlogCategory;
const deleteBlogCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await blog_category_service_1.blogCategoryService.deleteBlogCategory(id);
        return res.status(200).json({
            success: true,
            message: "Blog category deleted successfully",
        });
    }
    catch (error) {
        console.error("Error deleting blog category:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete blog category",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.deleteBlogCategory = deleteBlogCategory;
//# sourceMappingURL=blog-category.controller.js.map