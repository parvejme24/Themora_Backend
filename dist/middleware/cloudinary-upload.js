"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadBuffersToCloudinary = exports.extractPublicId = exports.deleteCloudinaryFile = exports.getFileUrl = exports.handleUploadError = exports.uploadArchiveFile = exports.uploadBufferToCloudinary = exports.uploadImageMemory = exports.uploadTemplateImageCloudinary = exports.uploadAvatarImageCloudinary = exports.uploadBlogImageCloudinary = exports.uploadCategoryImageCloudinary = exports.debugCloudinaryConfig = exports.cloudinaryHealthCheck = void 0;
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = require("cloudinary");
const secret_1 = require("../config/secret");
const initializeCloudinary = () => {
    try {
        if (secret_1.CLOUDINARY_URL) {
            cloudinary_1.v2.config(secret_1.CLOUDINARY_URL);
            cloudinary_1.v2.config({ secure: true });
        }
        else {
            cloudinary_1.v2.config({
                cloud_name: secret_1.CLOUDINARY_CLOUD_NAME,
                api_key: secret_1.CLOUDINARY_API_KEY,
                api_secret: secret_1.CLOUDINARY_API_SECRET,
                secure: true,
            });
        }
        setTimeout(() => {
            console.log("Cloudinary initialized:", !!cloudinary_1.v2.uploader);
        }, 100);
        return true;
    }
    catch (error) {
        console.error("Cloudinary configuration error:", error);
        return false;
    }
};
initializeCloudinary();
const masked = {
    cloud_name: secret_1.CLOUDINARY_CLOUD_NAME || (secret_1.CLOUDINARY_URL ? "from_URL" : "undefined"),
    api_key: secret_1.CLOUDINARY_API_KEY ? "***" + secret_1.CLOUDINARY_API_KEY.slice(-4) : (secret_1.CLOUDINARY_URL ? "from_URL" : "undefined"),
    api_secret: secret_1.CLOUDINARY_API_SECRET ? "***" + secret_1.CLOUDINARY_API_SECRET.slice(-4) : (secret_1.CLOUDINARY_URL ? "from_URL" : "undefined"),
};
console.log("Cloudinary Config:", masked);
const isCloudinaryConfigured = Boolean(secret_1.CLOUDINARY_URL || (secret_1.CLOUDINARY_CLOUD_NAME && secret_1.CLOUDINARY_API_KEY && secret_1.CLOUDINARY_API_SECRET));
const verifyCloudinaryConfig = () => {
    if (!isCloudinaryConfigured) {
        return false;
    }
    try {
        if (!cloudinary_1.v2 || !cloudinary_1.v2.uploader) {
            console.error("Cloudinary uploader not available");
            return false;
        }
        if (typeof cloudinary_1.v2.uploader.upload_stream !== 'function') {
            console.error("Cloudinary uploader methods not available");
            return false;
        }
        return true;
    }
    catch (error) {
        console.error("Cloudinary verification failed:", error);
        return false;
    }
};
const cloudinaryHealthCheck = async () => {
    if (!isCloudinaryConfigured) {
        return { ok: false, message: "Cloudinary not configured" };
    }
    try {
        if (!cloudinary_1.v2.uploader) {
            return { ok: false, message: "Cloudinary uploader not available" };
        }
        const result = await cloudinary_1.v2.api.ping();
        return { ok: true, message: JSON.stringify(result) };
    }
    catch (err) {
        return { ok: false, message: err?.message || "Unknown Cloudinary error" };
    }
};
exports.cloudinaryHealthCheck = cloudinaryHealthCheck;
const debugCloudinaryConfig = () => {
    console.log("=== Cloudinary Debug Info ===");
    console.log("isCloudinaryConfigured:", isCloudinaryConfigured);
    console.log("cloudinary object:", !!cloudinary_1.v2);
    console.log("cloudinary.uploader:", !!cloudinary_1.v2?.uploader);
    console.log("cloudinary.api:", !!cloudinary_1.v2?.api);
    console.log("verifyCloudinaryConfig():", verifyCloudinaryConfig());
    console.log("=============================");
};
exports.debugCloudinaryConfig = debugCloudinaryConfig;
const imageFilter = (req, file, cb) => {
    const fileExtension = file.originalname.toLowerCase().split(".").pop();
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(fileExtension)) {
        cb(null, true);
    }
    else {
        cb(new Error("Only image files are allowed"), false);
    }
};
const templateFileFilter = (req, file, cb) => {
    const fileExtension = file.originalname.toLowerCase().split(".").pop();
    if (file.fieldname === 'image') {
        if (["jpg", "jpeg", "png", "gif", "webp"].includes(fileExtension)) {
            cb(null, true);
        }
        else {
            cb(new Error("Only image files are allowed for image field"), false);
        }
    }
    else if (file.fieldname === 'sourceFiles') {
        cb(null, true);
    }
    else {
        cb(new Error("Invalid field name"), false);
    }
};
exports.uploadCategoryImageCloudinary = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
}).single("image");
exports.uploadBlogImageCloudinary = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    fileFilter: imageFilter,
    limits: { fileSize: 10 * 1024 * 1024 },
}).single("image");
exports.uploadAvatarImageCloudinary = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
}).single("image");
exports.uploadTemplateImageCloudinary = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    fileFilter: templateFileFilter,
    limits: { fileSize: 50 * 1024 * 1024 },
}).fields([
    { name: 'image', maxCount: 1 },
    { name: 'sourceFiles', maxCount: 10 }
]);
exports.uploadImageMemory = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    fileFilter: imageFilter,
    limits: { fileSize: 10 * 1024 * 1024 },
}).single("image");
const uploadBufferToCloudinary = (file, folder = "themora/uploads") => {
    return new Promise((resolve, reject) => {
        if (!file || !file.buffer) {
            return reject(new Error("No file buffer provided"));
        }
        const stream = cloudinary_1.v2.uploader.upload_stream({
            folder,
            resource_type: "image",
            transformation: [{ width: 800, height: 600, crop: "limit", quality: "auto" }],
        }, (error, result) => {
            if (error)
                return reject(error);
            return resolve({ url: result.secure_url, publicId: result.public_id });
        });
        stream.end(file.buffer);
    });
};
exports.uploadBufferToCloudinary = uploadBufferToCloudinary;
const uploadArchiveFile = (file, folder = "themora/source-files") => {
    return new Promise((resolve, reject) => {
        if (!file || !file.buffer) {
            return reject(new Error("No file buffer provided"));
        }
        const stream = cloudinary_1.v2.uploader.upload_stream({
            folder: folder,
            resource_type: "raw",
            public_id: `${Date.now()}_${file.originalname.split('.')[0]}`,
        }, (error, result) => {
            if (error) {
                console.error("Cloudinary raw upload error:", error);
                return reject(error);
            }
            if (!result) {
                return reject(new Error("No result from Cloudinary"));
            }
            resolve({
                url: result.secure_url,
                publicId: result.public_id,
            });
        });
        stream.end(file.buffer);
    });
};
exports.uploadArchiveFile = uploadArchiveFile;
const handleUploadError = (error, req, res, next) => {
    console.error("Cloudinary upload error:", {
        name: error?.name,
        message: error?.message,
        http_code: error?.http_code,
        code: error?.code,
        details: error
    });
    if (!isCloudinaryConfigured) {
        return res.status(503).json({
            success: false,
            message: "Cloudinary not configured",
            error: "Missing CLOUDINARY credentials"
        });
    }
    if (!verifyCloudinaryConfig()) {
        return res.status(503).json({
            success: false,
            message: "Cloudinary configuration error. Please check your credentials.",
            error: "Cloudinary uploader not available"
        });
    }
    if (error instanceof multer_1.default.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                message: "File too large. Maximum size is 5MB.",
                error: error.message,
            });
        }
        if (error.code === "LIMIT_FILE_COUNT") {
            return res.status(400).json({
                success: false,
                message: "Too many files. Only one image allowed.",
                error: error.message,
            });
        }
        if (error.code === "LIMIT_UNEXPECTED_FILE") {
            return res.status(400).json({
                success: false,
                message: "Unexpected field. Use 'image' field for file upload.",
                error: error.message,
            });
        }
    }
    if (error.message && error.message.includes("Only image files")) {
        return res.status(400).json({
            success: false,
            message: "Invalid file type. Only image files are allowed.",
            error: error.message,
        });
    }
    if (error.http_code) {
        return res.status(error.http_code >= 400 ? error.http_code : 500).json({
            success: false,
            message: "Cloudinary error",
            error: error.message || "Unknown Cloudinary error"
        });
    }
    if (error.message && /uploader|configuration|authorization|signature|api key/i.test(error.message)) {
        return res.status(500).json({
            success: false,
            message: "Cloudinary configuration error. Please check your credentials.",
            error: error.message
        });
    }
    return res.status(500).json({
        success: false,
        message: "Upload error",
        error: error.message || "Unknown error occurred",
    });
};
exports.handleUploadError = handleUploadError;
const getFileUrl = (file) => {
    return file ? file.path : null;
};
exports.getFileUrl = getFileUrl;
const deleteCloudinaryFile = async (publicId) => {
    try {
        const result = await cloudinary_1.v2.uploader.destroy(publicId);
        return result.result === "ok";
    }
    catch (error) {
        console.error("Error deleting file from Cloudinary:", error);
        return false;
    }
};
exports.deleteCloudinaryFile = deleteCloudinaryFile;
const extractPublicId = (url) => {
    const matches = url.match(/\/v\d+\/(.+)\.(jpg|jpeg|png|gif|webp)$/i);
    return matches ? matches[1] : null;
};
exports.extractPublicId = extractPublicId;
const uploadBuffersToCloudinary = async (files, folder = "themora/uploads") => {
    const uploadPromises = files.map(file => (0, exports.uploadBufferToCloudinary)(file, folder));
    return Promise.all(uploadPromises);
};
exports.uploadBuffersToCloudinary = uploadBuffersToCloudinary;
//# sourceMappingURL=cloudinary-upload.js.map