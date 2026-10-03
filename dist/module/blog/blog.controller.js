"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserReaction = exports.getBlogReactions = exports.addBlogReaction = exports.getDraftBlogs = exports.getPublishedBlogs = exports.togglePublish = exports.toggleBlogLike = exports.getBlogStats = exports.getBlogsByAuthor = exports.getBlogsByCategory = exports.deleteBlog = exports.updateBlog = exports.addBlog = exports.getBlogById = exports.getAllBlogs = void 0;
const blog_service_1 = require("./blog.service");
const cloudinary_upload_1 = require("../../middleware/cloudinary-upload");
const getAllBlogs = async (req, res) => {
    try {
        const user = req.user;
        const query = {
            ...(req.validatedQuery || req.query),
            ...(user?.role === "ADMIN" ? {} : { isPublished: true }),
        };
        const result = await blog_service_1.blogService.getAllBlogs(query);
        return res.status(200).json({
            success: true,
            message: "Blogs fetched successfully",
            data: result.blogs,
            pagination: result.pagination,
        });
    }
    catch (error) {
        console.error("Error fetching blogs:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch blogs",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getAllBlogs = getAllBlogs;
const getBlogById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || req.userId;
        const blog = await blog_service_1.blogService.getBlogById(id);
        if (!blog) {
            return res.status(404).json({
                success: false,
                message: "Blog not found",
                data: null,
            });
        }
        if (!blog.isPublished && req.user?.role !== "ADMIN" && blog.authorId !== req.user?.id) {
            return res.status(404).json({ success: false, message: "Blog not found", data: null });
        }
        if (userId) {
            await blog_service_1.blogService.incrementViewCount(id, userId);
        }
        return res.status(200).json({
            success: true,
            message: "Blog fetched successfully",
            data: blog,
        });
    }
    catch (error) {
        console.error("Error fetching blog:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch blog",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getBlogById = getBlogById;
const addBlog = async (req, res) => {
    try {
        let blogData = { ...req.body };
        if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
            if (blogData.content && typeof blogData.content === 'string') {
                try {
                    blogData.content = JSON.parse(blogData.content);
                }
                catch (e) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid content format. Must be valid JSON.",
                        error: "Content field must be a valid JSON string"
                    });
                }
            }
            if (blogData.readingTime && typeof blogData.readingTime === 'string') {
                blogData.readingTime = parseFloat(blogData.readingTime);
            }
            if (blogData.isPublished && typeof blogData.isPublished === 'string') {
                blogData.isPublished = blogData.isPublished === 'true';
            }
        }
        if (req.headers['content-type']?.includes('multipart/form-data')) {
            const mainImageFile = req.file;
            const filesMap = req.files || {};
            const additionalImageFiles = Array.isArray(filesMap.images) ? filesMap.images : [];
            if (mainImageFile) {
                try {
                    const uploadedMain = await (0, cloudinary_upload_1.uploadBufferToCloudinary)(mainImageFile, "themora/blogs");
                    blogData.featuredImageUrl = uploadedMain.url;
                    console.log("✅ Featured image uploaded successfully:", uploadedMain.url);
                }
                catch (error) {
                    console.error("❌ Error uploading featured image:", error);
                    return res.status(500).json({
                        success: false,
                        message: "Failed to upload featured image",
                        error: error instanceof Error ? error.message : "Unknown error",
                    });
                }
            }
            if (additionalImageFiles.length > 0) {
                try {
                    const uploaded = await (0, cloudinary_upload_1.uploadBuffersToCloudinary)(additionalImageFiles, "themora/blogs");
                    blogData.screenshots = uploaded.map((u) => u.url);
                    console.log("✅ Additional images uploaded successfully:", uploaded.length);
                }
                catch (error) {
                    console.error("❌ Error uploading additional images:", error);
                    return res.status(500).json({
                        success: false,
                        message: "Failed to upload additional images",
                        error: error instanceof Error ? error.message : "Unknown error",
                    });
                }
            }
            if (blogData.content && typeof blogData.content === 'string') {
                try {
                    blogData.content = JSON.parse(blogData.content);
                }
                catch (e) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid content format. Must be valid JSON.",
                        error: "Content field must be a valid JSON string"
                    });
                }
            }
            if (blogData.readingTime && typeof blogData.readingTime === 'string') {
                blogData.readingTime = parseFloat(blogData.readingTime);
            }
            if (blogData.isPublished && typeof blogData.isPublished === 'string') {
                blogData.isPublished = blogData.isPublished === 'true';
            }
        }
        const user = req.user;
        blogData.authorId = user.id;
        if (user.role !== "ADMIN")
            blogData.isPublished = false;
        const blog = await blog_service_1.blogService.createBlog(blogData);
        return res.status(201).json({
            success: true,
            message: "Blog created successfully",
            data: blog,
        });
    }
    catch (error) {
        console.error("Error creating blog:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create blog",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.addBlog = addBlog;
const updateBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const existingBlog = await blog_service_1.blogService.getBlogById(id);
        if (!existingBlog)
            return res.status(404).json({ success: false, message: "Blog not found", data: null });
        if (user.role !== "ADMIN" && existingBlog.authorId !== user.id) {
            return res.status(403).json({ success: false, message: "You can only update your own blog posts" });
        }
        let updateData = { ...req.body };
        if (req.headers['content-type']?.includes('multipart/form-data')) {
            const mainImageFile = req.file;
            const filesMap = req.files || {};
            const additionalImageFiles = Array.isArray(filesMap.images) ? filesMap.images : [];
            if (mainImageFile) {
                try {
                    const uploadedMain = await (0, cloudinary_upload_1.uploadBufferToCloudinary)(mainImageFile, "themora/blogs");
                    updateData.featuredImageUrl = uploadedMain.url;
                    console.log("✅ Featured image uploaded successfully:", uploadedMain.url);
                }
                catch (error) {
                    console.error("❌ Error uploading featured image:", error);
                    return res.status(500).json({
                        success: false,
                        message: "Failed to upload featured image",
                        error: error instanceof Error ? error.message : "Unknown error",
                    });
                }
            }
            if (additionalImageFiles.length > 0) {
                try {
                    const uploaded = await (0, cloudinary_upload_1.uploadBuffersToCloudinary)(additionalImageFiles, "themora/blogs");
                    updateData.screenshots = uploaded.map((u) => u.url);
                    console.log("✅ Additional images uploaded successfully:", uploaded.length);
                }
                catch (error) {
                    console.error("❌ Error uploading additional images:", error);
                    return res.status(500).json({
                        success: false,
                        message: "Failed to upload additional images",
                        error: error instanceof Error ? error.message : "Unknown error",
                    });
                }
            }
            if (updateData.content && typeof updateData.content === 'string') {
                try {
                    updateData.content = JSON.parse(updateData.content);
                }
                catch (e) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid content format. Must be valid JSON.",
                        error: "Content field must be a valid JSON string"
                    });
                }
            }
            if (updateData.readingTime && typeof updateData.readingTime === 'string') {
                updateData.readingTime = parseFloat(updateData.readingTime);
            }
            if (updateData.isPublished && typeof updateData.isPublished === 'string') {
                updateData.isPublished = updateData.isPublished === 'true';
            }
        }
        if (user.role !== "ADMIN")
            updateData.isPublished = false;
        const blog = await blog_service_1.blogService.updateBlog(id, updateData);
        if (!blog) {
            return res.status(404).json({
                success: false,
                message: "Blog not found",
                data: null,
            });
        }
        return res.status(200).json({
            success: true,
            message: "Blog updated successfully",
            data: blog,
        });
    }
    catch (error) {
        console.error("Error updating blog:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update blog",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.updateBlog = updateBlog;
const deleteBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const blog = await blog_service_1.blogService.getBlogById(id);
        if (!blog)
            return res.status(404).json({ success: false, message: "Blog not found", data: null });
        if (user.role !== "ADMIN" && blog.authorId !== user.id) {
            return res.status(403).json({ success: false, message: "You can only delete your own blog posts" });
        }
        const deleted = await blog_service_1.blogService.deleteBlog(id);
        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: "Blog not found",
                data: null,
            });
        }
        return res.status(200).json({
            success: true,
            message: "Blog deleted successfully",
            data: null,
        });
    }
    catch (error) {
        console.error("Error deleting blog:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete blog",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.deleteBlog = deleteBlog;
const getBlogsByCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const user = req.user;
        const query = {
            ...(req.validatedQuery || req.query),
            ...(user?.role === "ADMIN" ? {} : { isPublished: true }),
        };
        const result = await blog_service_1.blogService.getBlogsByCategory(categoryId, query);
        return res.status(200).json({
            success: true,
            message: "Blogs fetched successfully",
            data: result.blogs,
            pagination: result.pagination,
        });
    }
    catch (error) {
        console.error("Error fetching blogs by category:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch blogs by category",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getBlogsByCategory = getBlogsByCategory;
const getBlogsByAuthor = async (req, res) => {
    try {
        const { authorId } = req.params;
        const user = req.user;
        const canViewDrafts = user?.role === "ADMIN" || user?.id === authorId;
        const query = {
            ...(req.validatedQuery || req.query),
            ...(canViewDrafts ? {} : { isPublished: true }),
        };
        const result = await blog_service_1.blogService.getBlogsByAuthor(authorId, query);
        return res.status(200).json({
            success: true,
            message: "Blogs fetched successfully",
            data: result.blogs,
            pagination: result.pagination,
        });
    }
    catch (error) {
        console.error("Error fetching blogs by author:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch blogs by author",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getBlogsByAuthor = getBlogsByAuthor;
const getBlogStats = async (req, res) => {
    try {
        const stats = await blog_service_1.blogService.getBlogStats();
        return res.status(200).json({
            success: true,
            message: "Blog statistics fetched successfully",
            data: stats,
        });
    }
    catch (error) {
        console.error("Error fetching blog statistics:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch blog statistics",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getBlogStats = getBlogStats;
const toggleBlogLike = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required",
                data: null,
            });
        }
        const result = await blog_service_1.blogService.toggleLike(id, userId);
        return res.status(200).json({
            success: true,
            message: result.liked ? "Blog liked successfully" : "Blog unliked successfully",
            data: result,
        });
    }
    catch (error) {
        console.error("Error toggling blog like:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to toggle blog like",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.toggleBlogLike = toggleBlogLike;
const togglePublish = async (req, res) => {
    try {
        const { id } = req.params;
        const blog = await blog_service_1.blogService.togglePublish(id);
        if (!blog) {
            return res.status(404).json({
                success: false,
                message: "Blog not found",
                data: null,
            });
        }
        return res.status(200).json({
            success: true,
            message: blog.isPublished ? "Blog published successfully" : "Blog moved to draft successfully",
            data: blog,
        });
    }
    catch (error) {
        console.error("Error toggling blog publish status:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to toggle blog publish status",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.togglePublish = togglePublish;
const getPublishedBlogs = async (req, res) => {
    try {
        const query = { ...req.query, isPublished: true };
        const result = await blog_service_1.blogService.getAllBlogs(query);
        return res.status(200).json({
            success: true,
            message: "Published blogs fetched successfully",
            data: result.blogs,
            pagination: result.pagination,
        });
    }
    catch (error) {
        console.error("Error fetching published blogs:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch published blogs",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getPublishedBlogs = getPublishedBlogs;
const getDraftBlogs = async (req, res) => {
    try {
        const query = { ...req.query, isPublished: false };
        const result = await blog_service_1.blogService.getAllBlogs(query);
        return res.status(200).json({
            success: true,
            message: "Draft blogs fetched successfully",
            data: result.blogs,
            pagination: result.pagination,
        });
    }
    catch (error) {
        console.error("Error fetching draft blogs:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch draft blogs",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getDraftBlogs = getDraftBlogs;
const addBlogReaction = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const { reactionType } = req.body;
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required",
                data: null,
            });
        }
        const result = await blog_service_1.blogService.addReaction(id, userId, reactionType);
        return res.status(200).json({
            success: true,
            message: result.reaction ? "Reaction added successfully" : "Reaction removed successfully",
            data: result,
        });
    }
    catch (error) {
        console.error("Error adding reaction:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to add reaction",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.addBlogReaction = addBlogReaction;
const getBlogReactions = async (req, res) => {
    try {
        const { id } = req.params;
        const reactions = await blog_service_1.blogService.getBlogReactions(id);
        return res.status(200).json({
            success: true,
            message: "Reactions fetched successfully",
            data: reactions,
        });
    }
    catch (error) {
        console.error("Error fetching reactions:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch reactions",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getBlogReactions = getBlogReactions;
const getUserReaction = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({
                success: false,
                message: "User ID is required",
                data: null,
            });
        }
        const reaction = await blog_service_1.blogService.getUserReaction(id, userId);
        return res.status(200).json({
            success: true,
            message: "User reaction fetched successfully",
            data: reaction,
        });
    }
    catch (error) {
        console.error("Error fetching user reaction:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch user reaction",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getUserReaction = getUserReaction;
//# sourceMappingURL=blog.controller.js.map