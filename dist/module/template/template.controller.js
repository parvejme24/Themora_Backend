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
exports.getTemplateStats = exports.getNewArrivals = exports.downloadSourceFile = exports.deleteTemplate = exports.updateTemplate = exports.createTemplate = exports.getTemplateById = exports.getAllTemplates = void 0;
const client_1 = require("@prisma/client");
const template_service_1 = require("./template.service");
const order_service_1 = require("../order/order.service");
const templateService = new template_service_1.TemplateService();
const prisma = new client_1.PrismaClient();
const orderService = new order_service_1.OrderService();
const userHasTemplateAccess = async (userId, templateId) => {
    const [license, planEntitlement] = await Promise.all([
        prisma.license.findFirst({
            where: { userId, templateId, isActive: true, order: { status: "COMPLETED" } },
            select: { id: true },
        }),
        prisma.planEntitlement.findFirst({
            where: { userId, isActive: true, order: { status: "COMPLETED" } },
            select: { id: true },
        }),
    ]);
    return Boolean(license || planEntitlement);
};
const getAllTemplates = async (req, res) => {
    try {
        const query = req.validatedQuery || req.query;
        const { page = 1, limit = 10, search, categoryId, sortBy, sortOrder, minPrice, maxPrice } = query;
        const result = await templateService.getAllTemplates({
            page,
            limit,
            search,
            categoryId,
            sortBy,
            sortOrder,
            minPrice,
            maxPrice,
        });
        return res.status(200).json({
            success: true,
            message: "Templates fetched successfully",
            data: req.user?.role === "ADMIN"
                ? result.templates
                : result.templates.map(({ sourceFiles, ...template }) => template),
            pagination: result.pagination,
        });
    }
    catch (error) {
        console.error("Error fetching templates:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch templates",
            error: error.message,
        });
    }
};
exports.getAllTemplates = getAllTemplates;
const getTemplateById = async (req, res) => {
    try {
        const { id } = req.params;
        const template = await templateService.getTemplateById(id);
        if (!template) {
            return res.status(404).json({
                success: false,
                message: "Template not found",
                data: null,
            });
        }
        const safeTemplate = req.user?.role === "ADMIN"
            ? template
            : (({ sourceFiles, ...publicTemplate }) => ({ ...publicTemplate, sourceFileCount: sourceFiles.length }))(template);
        return res.status(200).json({
            success: true,
            message: "Template fetched successfully",
            data: safeTemplate,
        });
    }
    catch (error) {
        console.error("Error fetching template:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch template",
            error: error.message,
        });
    }
};
exports.getTemplateById = getTemplateById;
const createTemplate = async (req, res) => {
    try {
        const data = req.validatedData;
        const { uploadBufferToCloudinary } = await Promise.resolve().then(() => __importStar(require("../../middleware/cloudinary-upload")));
        if (req.files && req.files.image && req.files.image[0]) {
            try {
                const uploadResult = await uploadBufferToCloudinary(req.files.image[0], "themora/templates");
                data.imageUrl = uploadResult.url;
            }
            catch (uploadError) {
                console.error("Error uploading image:", uploadError);
                return res.status(400).json({
                    success: false,
                    message: "Failed to upload image",
                    error: uploadError,
                });
            }
        }
        if (req.files && req.files.sourceFiles && req.files.sourceFiles.length > 0) {
            try {
                const sourceFileUrls = [];
                for (const file of req.files.sourceFiles) {
                    const fileExtension = file.originalname.toLowerCase().split('.').pop();
                    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(fileExtension)) {
                        const { uploadArchiveFile } = await Promise.resolve().then(() => __importStar(require("../../middleware/cloudinary-upload")));
                        const uploadResult = await uploadArchiveFile(file, "themora/source-files");
                        sourceFileUrls.push(uploadResult.url);
                    }
                    else {
                        const uploadResult = await uploadBufferToCloudinary(file, "themora/templates/source-files");
                        sourceFileUrls.push(uploadResult.url);
                    }
                }
                data.sourceFiles = sourceFileUrls;
            }
            catch (uploadError) {
                console.error("Error uploading source files:", uploadError);
                return res.status(400).json({
                    success: false,
                    message: "Failed to upload source files",
                    error: uploadError,
                });
            }
        }
        const template = await templateService.createTemplate(data);
        return res.status(201).json({
            success: true,
            message: "Template created successfully",
            data: template,
        });
    }
    catch (error) {
        console.error("Error creating template:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to create template",
        });
    }
};
exports.createTemplate = createTemplate;
const updateTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.validatedData;
        const { uploadBufferToCloudinary } = await Promise.resolve().then(() => __importStar(require("../../middleware/cloudinary-upload")));
        if (req.files && req.files.image && req.files.image[0]) {
            try {
                const uploadResult = await uploadBufferToCloudinary(req.files.image[0], "themora/templates");
                data.imageUrl = uploadResult.url;
            }
            catch (uploadError) {
                console.error("Error uploading image:", uploadError);
                return res.status(400).json({
                    success: false,
                    message: "Failed to upload image",
                    error: uploadError,
                });
            }
        }
        if (req.files && req.files.sourceFiles && req.files.sourceFiles.length > 0) {
            try {
                const sourceFileUrls = [];
                for (const file of req.files.sourceFiles) {
                    const fileExtension = file.originalname.toLowerCase().split('.').pop();
                    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(fileExtension)) {
                        const { uploadArchiveFile } = await Promise.resolve().then(() => __importStar(require("../../middleware/cloudinary-upload")));
                        const uploadResult = await uploadArchiveFile(file, "themora/source-files");
                        sourceFileUrls.push(uploadResult.url);
                    }
                    else {
                        const uploadResult = await uploadBufferToCloudinary(file, "themora/templates/source-files");
                        sourceFileUrls.push(uploadResult.url);
                    }
                }
                data.sourceFiles = sourceFileUrls;
            }
            catch (uploadError) {
                console.error("Error uploading source files:", uploadError);
                return res.status(400).json({
                    success: false,
                    message: "Failed to upload source files",
                    error: uploadError,
                });
            }
        }
        const template = await templateService.updateTemplate(id, data);
        if (!template) {
            return res.status(404).json({
                success: false,
                message: "Template not found",
                data: null,
            });
        }
        return res.status(200).json({
            success: true,
            message: "Template updated successfully",
            data: template,
        });
    }
    catch (error) {
        console.error("Error updating template:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to update template",
        });
    }
};
exports.updateTemplate = updateTemplate;
const deleteTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await templateService.deleteTemplate(id);
        if (!result.success) {
            return res.status(404).json({
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
        console.error("Error deleting template:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete template",
            error: error.message,
        });
    }
};
exports.deleteTemplate = deleteTemplate;
const downloadSourceFile = async (req, res) => {
    try {
        const { templateId, fileIndex } = req.params;
        const user = req.user;
        if (user?.role !== "ADMIN") {
            if (!user?.id || !user?.email)
                return res.status(401).json({ success: false, message: "Authentication required" });
            await orderService.claimGuestOrders(user.id, user.email);
            if (!(await userHasTemplateAccess(user.id, templateId))) {
                return res.status(403).json({ success: false, message: "Purchase this theme to download its files" });
            }
        }
        const template = await templateService.getTemplateById(templateId);
        if (!template) {
            return res.status(404).json({
                success: false,
                message: "Template not found",
            });
        }
        if (!/^\d+$/.test(fileIndex)) {
            return res.status(400).json({ success: false, message: "Invalid source file index" });
        }
        const fileIndexNum = Number(fileIndex);
        if (fileIndexNum >= template.sourceFiles.length) {
            return res.status(404).json({
                success: false,
                message: "Source file not found",
            });
        }
        const fileUrl = template.sourceFiles[fileIndexNum];
        if (fileUrl.includes('cloudinary.com') && fileUrl.includes('/raw/upload/')) {
            const downloadUrl = fileUrl.replace('/upload/', '/upload/fl_attachment/');
            return res.status(200).json({ success: true, data: { downloadUrl } });
        }
        else {
            return res.status(200).json({ success: true, data: { downloadUrl: fileUrl } });
        }
    }
    catch (error) {
        console.error("Error downloading source file:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to download source file",
        });
    }
};
exports.downloadSourceFile = downloadSourceFile;
const getNewArrivals = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        if (limit < 1 || limit > 50) {
            return res.status(400).json({
                success: false,
                message: "Limit must be between 1 and 50",
            });
        }
        const templates = await templateService.getNewArrivals(limit);
        const responseTemplates = req.user?.role === "ADMIN"
            ? templates
            : templates.map(({ sourceFiles, ...template }) => template);
        return res.status(200).json({
            success: true,
            message: "New arrivals fetched successfully",
            data: responseTemplates,
        });
    }
    catch (error) {
        console.error("Error fetching new arrivals:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch new arrivals",
            error: error.message,
        });
    }
};
exports.getNewArrivals = getNewArrivals;
const getTemplateStats = async (req, res) => {
    try {
        const stats = await templateService.getTemplateStats();
        return res.status(200).json({
            success: true,
            message: "Template statistics fetched successfully",
            data: stats,
        });
    }
    catch (error) {
        console.error("Error fetching template statistics:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch template statistics",
            error: error.message,
        });
    }
};
exports.getTemplateStats = getTemplateStats;
//# sourceMappingURL=template.controller.js.map