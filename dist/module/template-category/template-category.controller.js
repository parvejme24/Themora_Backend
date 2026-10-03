"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTemplateCategoryStats = exports.deleteTemplateCategory = exports.updateTemplateCategory = exports.getTemplateCategoryById = exports.getAllTemplateCategories = exports.createTemplateCategory = void 0;
const template_category_service_1 = require("./template-category.service");
const templateCategoryService = new template_category_service_1.TemplateCategoryService();
const createTemplateCategory = async (req, res) => {
    try {
        const data = req.validatedData;
        if (req.file) {
            try {
                const { uploadBufferToCloudinary } = await Promise.resolve().then(() => __importStar(require("../../middleware/cloudinary-upload")));
                const uploadResult = await uploadBufferToCloudinary(req.file, "themora/template-categories");
                data.image = uploadResult.url;
            }
            catch (uploadError) {
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
    }
    catch (error) {
        console.error("Error creating template category:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to create template category",
        });
    }
};
exports.createTemplateCategory = createTemplateCategory;
const getAllTemplateCategories = async (req, res) => {
    try {
        const query = req.validatedQuery || req.query;
        const { page = 1, limit = 10, search, sortBy, sortOrder } = query;
        const result = await templateCategoryService.getAllTemplateCategories(page, limit, search, sortBy, sortOrder);
        return res.status(200).json({
            success: true,
            message: "Template categories fetched successfully",
            data: result.categories,
            pagination: result.pagination,
        });
    }
    catch (error) {
        console.error("Error fetching template categories:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch template categories",
            error: error.message,
        });
    }
};
exports.getAllTemplateCategories = getAllTemplateCategories;
const getTemplateCategoryById = async (req, res) => {
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
    }
    catch (error) {
        console.error("Error fetching template category:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch template category",
            error: error.message,
        });
    }
};
exports.getTemplateCategoryById = getTemplateCategoryById;
const updateTemplateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.validatedData;
        if (req.file) {
            try {
                const { uploadBufferToCloudinary } = await Promise.resolve().then(() => __importStar(require("../../middleware/cloudinary-upload")));
                const uploadResult = await uploadBufferToCloudinary(req.file, "themora/template-categories");
                data.image = uploadResult.url;
            }
            catch (uploadError) {
                console.error("Cloudinary upload error:", uploadError);
                return res.status(500).json({
                    success: false,
                    message: "Failed to upload image to Cloudinary",
                    error: uploadError.message,
                });
            }
        }
        const category = await templateCategoryService.updateTemplateCategory(id, data);
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
    }
    catch (error) {
        console.error("Error updating template category:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to update template category",
        });
    }
};
exports.updateTemplateCategory = updateTemplateCategory;
const deleteTemplateCategory = async (req, res) => {
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
    }
    catch (error) {
        console.error("Error deleting template category:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete template category",
            error: error.message,
        });
    }
};
exports.deleteTemplateCategory = deleteTemplateCategory;
const getTemplateCategoryStats = async (req, res) => {
    try {
        const stats = await templateCategoryService.getTemplateCategoryStats();
        return res.status(200).json({
            success: true,
            message: "Template category statistics fetched successfully",
            data: stats,
        });
    }
    catch (error) {
        console.error("Error fetching template category statistics:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch template category statistics",
            error: error.message,
        });
    }
};
exports.getTemplateCategoryStats = getTemplateCategoryStats;
//# sourceMappingURL=template-category.controller.js.map