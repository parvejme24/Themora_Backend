import { Request, Response } from "express";
import { blogService } from "./blog.service";
import { uploadBufferToCloudinary, uploadBuffersToCloudinary } from "../../middleware/cloudinary-upload";
import { IBlogQuery } from "./blog.interface";

// Get all blogs
export const getAllBlogs = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const query: IBlogQuery = {
      ...((req as any).validatedQuery || req.query),
      ...(user?.role === "ADMIN" ? {} : { isPublished: true }),
    };
    const result = await blogService.getAllBlogs(query);
    
    return res.status(200).json({
      success: true,
      message: "Blogs fetched successfully",
      data: result.blogs,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error fetching blogs:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch blogs",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get blog by ID
export const getBlogById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Get userId from request (if user is logged in)
    const userId = (req as any).user?.id || (req as any).userId;
    
    const blog = await blogService.getBlogById(id);
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
        data: null,
      });
    }

    if (!blog.isPublished && (req as any).user?.role !== "ADMIN" && blog.authorId !== (req as any).user?.id) {
      return res.status(404).json({ success: false, message: "Blog not found", data: null });
    }
    
    // Increment view count only if user is logged in
    if (userId) {
      await blogService.incrementViewCount(id, userId);
    }
    
    return res.status(200).json({
      success: true,
      message: "Blog fetched successfully",
      data: blog,
    });
  } catch (error) {
    console.error("Error fetching blog:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch blog",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Create new blog
export const addBlog = async (req: Request, res: Response) => {
  try {
    // Handle both JSON and form-data
    let blogData = { ...req.body };
    
    // Parse JSON fields from form data
    if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      // Description is now a string field (no JSON parsing needed)
      
      // Parse content if it's a string (rich text editor content)
      if (blogData.content && typeof blogData.content === 'string') {
        try {
          blogData.content = JSON.parse(blogData.content);
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: "Invalid content format. Must be valid JSON.",
            error: "Content field must be a valid JSON string"
          });
        }
      }
      
      // Convert readingTime to number
      if (blogData.readingTime && typeof blogData.readingTime === 'string') {
        blogData.readingTime = parseFloat(blogData.readingTime);
      }
      
      // Convert isPublished to boolean
      if (blogData.isPublished && typeof blogData.isPublished === 'string') {
        blogData.isPublished = blogData.isPublished === 'true';
      }
    }
    
    // Handle multipart/form-data uploads (main image + additional images)
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      // Get the main image file from req.file (single upload)
      const mainImageFile = (req as any).file;
      
      // Get additional images from req.files (if using .array() or .fields())
      const filesMap = (req as any).files || {};
      const additionalImageFiles = Array.isArray(filesMap.images) ? filesMap.images : [];

      // Upload main image if provided
      if (mainImageFile) {
        try {
          const uploadedMain = await uploadBufferToCloudinary(mainImageFile, "themora/blogs");
          blogData.featuredImageUrl = uploadedMain.url;
          console.log("✅ Featured image uploaded successfully:", uploadedMain.url);
        } catch (error) {
          console.error("❌ Error uploading featured image:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to upload featured image",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // Upload additional images if provided
      if (additionalImageFiles.length > 0) {
        try {
          const uploaded = await uploadBuffersToCloudinary(additionalImageFiles, "themora/blogs");
          blogData.screenshots = uploaded.map((u: { url: string; publicId: string }) => u.url);
          console.log("✅ Additional images uploaded successfully:", uploaded.length);
        } catch (error) {
          console.error("❌ Error uploading additional images:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to upload additional images",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
      
      // Parse JSON fields from multipart form data
      // Description is now a string field (no JSON parsing needed)
      
      // Parse content if it's a string (rich text editor content)
      if (blogData.content && typeof blogData.content === 'string') {
        try {
          blogData.content = JSON.parse(blogData.content);
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: "Invalid content format. Must be valid JSON.",
            error: "Content field must be a valid JSON string"
          });
        }
      }
      
      // Convert readingTime to number
      if (blogData.readingTime && typeof blogData.readingTime === 'string') {
        blogData.readingTime = parseFloat(blogData.readingTime);
      }
      
      // Convert isPublished to boolean
      if (blogData.isPublished && typeof blogData.isPublished === 'string') {
        blogData.isPublished = blogData.isPublished === 'true';
      }
    }
    
    const user = (req as any).user;
    blogData.authorId = user.id;
    if (user.role !== "ADMIN") blogData.isPublished = false;

    const blog = await blogService.createBlog(blogData);
    
    return res.status(201).json({
      success: true,
      message: "Blog created successfully",
      data: blog,
    });
  } catch (error) {
    console.error("Error creating blog:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create blog",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Update blog
export const updateBlog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const existingBlog = await blogService.getBlogById(id);
    if (!existingBlog) return res.status(404).json({ success: false, message: "Blog not found", data: null });
    if (user.role !== "ADMIN" && existingBlog.authorId !== user.id) {
      return res.status(403).json({ success: false, message: "You can only update your own blog posts" });
    }
    
    // Handle both JSON and form-data
    let updateData = { ...req.body };
    
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      // Get the main image file from req.file (single upload)
      const mainImageFile = (req as any).file;
      
      // Get additional images from req.files (if using .array() or .fields())
      const filesMap = (req as any).files || {};
      const additionalImageFiles = Array.isArray(filesMap.images) ? filesMap.images : [];

      if (mainImageFile) {
        try {
          const uploadedMain = await uploadBufferToCloudinary(mainImageFile, "themora/blogs");
          updateData.featuredImageUrl = uploadedMain.url;
          console.log("✅ Featured image uploaded successfully:", uploadedMain.url);
        } catch (error) {
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
          const uploaded = await uploadBuffersToCloudinary(additionalImageFiles, "themora/blogs");
          updateData.screenshots = uploaded.map((u: { url: string; publicId: string }) => u.url);
          console.log("✅ Additional images uploaded successfully:", uploaded.length);
        } catch (error) {
          console.error("❌ Error uploading additional images:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to upload additional images",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
      
      // Parse JSON fields from multipart form data
      // Description is now a string field (no JSON parsing needed)
      
      // Parse content if it's a string (rich text editor content)
      if (updateData.content && typeof updateData.content === 'string') {
        try {
          updateData.content = JSON.parse(updateData.content);
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: "Invalid content format. Must be valid JSON.",
            error: "Content field must be a valid JSON string"
          });
        }
      }
      
      // Convert readingTime to number
      if (updateData.readingTime && typeof updateData.readingTime === 'string') {
        updateData.readingTime = parseFloat(updateData.readingTime);
      }
      
      // Convert isPublished to boolean
      if (updateData.isPublished && typeof updateData.isPublished === 'string') {
        updateData.isPublished = updateData.isPublished === 'true';
      }
    }

    if (user.role !== "ADMIN") updateData.isPublished = false;
    
    const blog = await blogService.updateBlog(id, updateData);
    
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
  } catch (error) {
    console.error("Error updating blog:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update blog",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Delete blog
export const deleteBlog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const blog = await blogService.getBlogById(id);
    if (!blog) return res.status(404).json({ success: false, message: "Blog not found", data: null });
    if (user.role !== "ADMIN" && blog.authorId !== user.id) {
      return res.status(403).json({ success: false, message: "You can only delete your own blog posts" });
    }
    
    const deleted = await blogService.deleteBlog(id);
    
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
  } catch (error) {
    console.error("Error deleting blog:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete blog",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get blogs by category
export const getBlogsByCategory = async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;
    const user = (req as any).user;
    const query: IBlogQuery = {
      ...((req as any).validatedQuery || req.query),
      ...(user?.role === "ADMIN" ? {} : { isPublished: true }),
    };
    
    const result = await blogService.getBlogsByCategory(categoryId, query);
    
    return res.status(200).json({
      success: true,
      message: "Blogs fetched successfully",
      data: result.blogs,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error fetching blogs by category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch blogs by category",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get blogs by author
export const getBlogsByAuthor = async (req: Request, res: Response) => {
  try {
    const { authorId } = req.params;
    const user = (req as any).user;
    const canViewDrafts = user?.role === "ADMIN" || user?.id === authorId;
    const query: IBlogQuery = {
      ...((req as any).validatedQuery || req.query),
      ...(canViewDrafts ? {} : { isPublished: true }),
    };
    
    const result = await blogService.getBlogsByAuthor(authorId, query);
    
    return res.status(200).json({
      success: true,
      message: "Blogs fetched successfully",
      data: result.blogs,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error fetching blogs by author:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch blogs by author",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get blog statistics
export const getBlogStats = async (req: Request, res: Response) => {
  try {
    const stats = await blogService.getBlogStats();
    
    return res.status(200).json({
      success: true,
      message: "Blog statistics fetched successfully",
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching blog statistics:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch blog statistics",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Toggle blog like
export const toggleBlogLike = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
        data: null,
      });
    }
    
    const result = await blogService.toggleLike(id, userId);
    
    return res.status(200).json({
      success: true,
      message: result.liked ? "Blog liked successfully" : "Blog unliked successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error toggling blog like:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle blog like",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};



// Toggle publish/unpublish
export const togglePublish = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const blog = await blogService.togglePublish(id);
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
  } catch (error) {
    console.error("Error toggling blog publish status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle blog publish status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get published blogs
export const getPublishedBlogs = async (req: Request, res: Response) => {
  try {
    const query: IBlogQuery = { ...req.query, isPublished: true };
    const result = await blogService.getAllBlogs(query);
    
    return res.status(200).json({
      success: true,
      message: "Published blogs fetched successfully",
      data: result.blogs,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error fetching published blogs:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch published blogs",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get draft blogs
export const getDraftBlogs = async (req: Request, res: Response) => {
  try {
    const query: IBlogQuery = { ...req.query, isPublished: false };
    const result = await blogService.getAllBlogs(query);
    
    return res.status(200).json({
      success: true,
      message: "Draft blogs fetched successfully",
      data: result.blogs,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error fetching draft blogs:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch draft blogs",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Add or update reaction
export const addBlogReaction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const rawType = req.body.reactionType || req.body.reaction || req.body.type || "LIKE";
    const reactionType = String(rawType).toUpperCase();
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
        data: null,
      });
    }
    
    const result = await blogService.addReaction(
      id,
      userId,
      reactionType as "LIKE" | "LOVE" | "HAHA" | "WOW" | "SAD" | "ANGRY"
    );
    
    return res.status(200).json({
      success: true,
      message: result.reaction ? "Reaction added successfully" : "Reaction removed successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error adding reaction:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add reaction",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get reactions for a blog
export const getBlogReactions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const reactions = await blogService.getBlogReactions(id);
    
    return res.status(200).json({
      success: true,
      message: "Reactions fetched successfully",
      data: reactions,
    });
  } catch (error) {
    console.error("Error fetching reactions:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch reactions",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get user's reaction for a blog
export const getUserReaction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
        data: null,
      });
    }
    
    const reaction = await blogService.getUserReaction(id, userId);
    
    return res.status(200).json({
      success: true,
      message: "User reaction fetched successfully",
      data: reaction,
    });
  } catch (error) {
    console.error("Error fetching user reaction:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user reaction",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
