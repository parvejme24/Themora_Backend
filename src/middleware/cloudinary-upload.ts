import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_URL } from "../config/secret";

// Configure Cloudinary v2 (supports CLOUDINARY_URL or explicit keys)
const initializeCloudinary = () => {
  try {
    if (CLOUDINARY_URL) {
      // Use single URL form per Cloudinary docs
      cloudinary.config(CLOUDINARY_URL as any);
      cloudinary.config({ secure: true });
    } else {
      cloudinary.config({
        cloud_name: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        api_secret: CLOUDINARY_API_SECRET,
        secure: true,
      });
    }
    
    // Wait a moment for initialization
    setTimeout(() => {
      console.log("Cloudinary initialized:", !!cloudinary.uploader);
    }, 100);
    
    return true;
  } catch (error) {
    console.error("Cloudinary configuration error:", error);
    return false;
  }
};

// Initialize Cloudinary
initializeCloudinary();

// Verify Cloudinary configuration (masked)
const masked = {
  cloud_name: CLOUDINARY_CLOUD_NAME || (CLOUDINARY_URL ? "from_URL" : "undefined"),
  api_key: CLOUDINARY_API_KEY ? "***" + CLOUDINARY_API_KEY.slice(-4) : (CLOUDINARY_URL ? "from_URL" : "undefined"),
  api_secret: CLOUDINARY_API_SECRET ? "***" + CLOUDINARY_API_SECRET.slice(-4) : (CLOUDINARY_URL ? "from_URL" : "undefined"),
};
console.log("Cloudinary Config:", masked);

// Early validation to surface config issues before first upload
const isCloudinaryConfigured = Boolean(
  CLOUDINARY_URL || (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET)
);

// Verify Cloudinary is properly initialized
const verifyCloudinaryConfig = () => {
  if (!isCloudinaryConfigured) {
    return false;
  }
  
  try {
    // Check if cloudinary object has required methods
    if (!cloudinary || !cloudinary.uploader) {
      console.error("Cloudinary uploader not available");
      return false;
    }
    
    // Test if uploader is actually functional
    if (typeof cloudinary.uploader.upload_stream !== 'function') {
      console.error("Cloudinary uploader methods not available");
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Cloudinary verification failed:", error);
    return false;
  }
};

// Optional health check function
export const cloudinaryHealthCheck = async (): Promise<{ ok: boolean; message: string }> => {
  if (!isCloudinaryConfigured) {
    return { ok: false, message: "Cloudinary not configured" };
  }
  try {
    // Check if uploader is available
    if (!cloudinary.uploader) {
      return { ok: false, message: "Cloudinary uploader not available" };
    }
    
    // ping via API call that doesn't upload
    const result = await (cloudinary.api as any).ping();
    return { ok: true, message: JSON.stringify(result) };
  } catch (err: any) {
    return { ok: false, message: err?.message || "Unknown Cloudinary error" };
  }
};

// Debug function to test Cloudinary initialization
export const debugCloudinaryConfig = () => {
  console.log("=== Cloudinary Debug Info ===");
  console.log("isCloudinaryConfigured:", isCloudinaryConfigured);
  console.log("cloudinary object:", !!cloudinary);
  console.log("cloudinary.uploader:", !!cloudinary?.uploader);
  console.log("cloudinary.api:", !!cloudinary?.api);
  console.log("verifyCloudinaryConfig():", verifyCloudinaryConfig());
  console.log("=============================");
};

// Note: We're using memory storage with manual Cloudinary uploads
// No need for CloudinaryStorage anymore

// File filter for images only
const imageFilter = (req: any, file: any, cb: any) => {
  const fileExtension = file.originalname.toLowerCase().split(".").pop();
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

// File filter for template uploads (images + source files)
const templateFileFilter = (req: any, file: any, cb: any) => {
  const fileExtension = file.originalname.toLowerCase().split(".").pop();
  
  // Allow images for 'image' field
  if (file.fieldname === 'image') {
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed for image field"), false);
    }
  }
  // Allow all file types for 'sourceFiles' field (including archives)
  else if (file.fieldname === 'sourceFiles') {
    // Allow all file types for source files
    cb(null, true);
  }
  else {
    cb(new Error("Invalid field name"), false);
  }
};

// Category image upload middleware - Use memory storage and handle upload manually
export const uploadCategoryImageCloudinary = multer({
  storage: multer.memoryStorage(), // Always use memory storage
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
}).single("image");

// Blog image upload middleware - Use memory storage and handle upload manually
export const uploadBlogImageCloudinary = multer({
  storage: multer.memoryStorage(), // Always use memory storage
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for blog images
}).single("image");

// Avatar image upload middleware - Use memory storage and handle upload manually
export const uploadAvatarImageCloudinary = multer({
  storage: multer.memoryStorage(), // Always use memory storage
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB for avatars
}).single("image");

// Template image upload middleware - Use memory storage and handle upload manually
export const uploadTemplateImageCloudinary = multer({
  storage: multer.memoryStorage(), // Always use memory storage
  fileFilter: templateFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for template files (larger for source files)
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'sourceFiles', maxCount: 10 }
]);

// Cover image upload middleware
// (Cover image upload middleware removed by request)

// Memory storage upload (fallback when Cloudinary storage package fails)
export const uploadImageMemory = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).single("image");

// Upload a buffer to Cloudinary using upload_stream
export const uploadBufferToCloudinary = (file: Express.Multer.File, folder = "themora/uploads"): Promise<{ url: string; publicId: string }> => {
  return new Promise((resolve, reject) => {
    if (!file || !file.buffer) {
      return reject(new Error("No file buffer provided"));
    }
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [{ width: 800, height: 600, crop: "limit", quality: "auto" }],
      },
      (error: any, result: any) => {
        if (error) return reject(error);
        return resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(file.buffer);
  });
};

// Upload ZIP files and other archives to Cloudinary as raw files
export const uploadArchiveFile = (file: Express.Multer.File, folder = "themora/source-files"): Promise<{ url: string; publicId: string }> => {
  return new Promise((resolve, reject) => {
    if (!file || !file.buffer) {
      return reject(new Error("No file buffer provided"));
    }
    
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: "raw", // Use raw resource type for ZIP files
        public_id: `${Date.now()}_${file.originalname.split('.')[0]}`,
      },
      (error: any, result: any) => {
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
      }
    );
    stream.end(file.buffer);
  });
};

// Error handling middleware
export const handleUploadError = (error: any, req: any, res: any, next: any) => {
  // Log full error for diagnostics
  console.error("Cloudinary upload error:", {
    name: error?.name,
    message: error?.message,
    http_code: error?.http_code,
    code: error?.code,
    details: error
  });

  // Early guard: not configured
  if (!isCloudinaryConfigured) {
    return res.status(503).json({
      success: false,
      message: "Cloudinary not configured",
      error: "Missing CLOUDINARY credentials"
    });
  }

  // Check if Cloudinary is properly initialized
  if (!verifyCloudinaryConfig()) {
    return res.status(503).json({
      success: false,
      message: "Cloudinary configuration error. Please check your credentials.",
      error: "Cloudinary uploader not available"
    });
  }

  // Note: We're using memory storage, no need to check CloudinaryStorage
  if (error instanceof multer.MulterError) {
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

  // Cloudinary API errors
  if (error.http_code) {
    return res.status(error.http_code >= 400 ? error.http_code : 500).json({
      success: false,
      message: "Cloudinary error",
      error: error.message || "Unknown Cloudinary error"
    });
  }

  // Fallback message if error hints at uploader/config
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

// Utility function to get file URL from uploaded file
export const getFileUrl = (file: any): string | null => {
  return file ? file.path : null;
};

// Utility function to delete file from Cloudinary
export const deleteCloudinaryFile = async (publicId: string): Promise<boolean> => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === "ok";
  } catch (error) {
    console.error("Error deleting file from Cloudinary:", error);
    return false;
  }
};

// Utility function to extract public ID from Cloudinary URL
export const extractPublicId = (url: string): string | null => {
  const matches = url.match(/\/v\d+\/(.+)\.(jpg|jpeg|png|gif|webp)$/i);
  return matches ? matches[1] : null;
};

// Upload multiple buffers to Cloudinary
export const uploadBuffersToCloudinary = async (files: Express.Multer.File[], folder = "themora/uploads"): Promise<{ url: string; publicId: string }[]> => {
  const uploadPromises = files.map(file => uploadBufferToCloudinary(file, folder));
  return Promise.all(uploadPromises);
};
