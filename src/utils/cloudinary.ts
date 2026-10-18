import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";
import { AppError } from "./AppError";

const credentials = () => {
  const fromUrl = env.CLOUDINARY_URL ? new URL(env.CLOUDINARY_URL) : null;
  const cloudName = env.CLOUDINARY_CLOUD_NAME || fromUrl?.hostname || "";
  const apiKey = env.CLOUDINARY_API_KEY || decodeURIComponent(fromUrl?.username ?? "");
  const apiSecret = env.CLOUDINARY_API_SECRET || decodeURIComponent(fromUrl?.password ?? "");
  if (!cloudName || !apiKey || !apiSecret) throw new AppError(503, "File storage (Cloudinary) is not configured");
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  return { cloudName, apiKey, apiSecret };
};

const UPLOAD_KINDS = {
  // Product source archives: private, only reachable through signed links
  source: { resourceType: "raw", type: "authenticated", folder: "themora/source-files" },
  image: { resourceType: "image", type: "upload", folder: "themora/products" },
} as const;

export type UploadKind = keyof typeof UPLOAD_KINDS;

/**
 * Signature for a direct browser → Cloudinary upload, so large files never
 * pass through the API (Vercel limits request bodies to ~4.5 MB).
 */
export const signUpload = (kind: UploadKind) => {
  const { cloudName, apiKey, apiSecret } = credentials();
  const { resourceType, type, folder } = UPLOAD_KINDS[kind];
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder, timestamp, type, use_filename: "true", unique_filename: "true" };
  const signature = cloudinary.utils.api_sign_request(params, apiSecret);
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    fields: { ...params, api_key: apiKey, signature },
    resourceType,
  };
};

// Signed link to a private source file; stops working after `ttlSeconds`
export const privateDownloadUrl = (publicId: string, ttlSeconds = 300) => {
  credentials();
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const url = cloudinary.utils.private_download_url(publicId, "", {
    resource_type: "raw",
    type: "authenticated",
    attachment: true,
    expires_at: expiresAt,
  });
  return { url, expiresAt: new Date(expiresAt * 1000) };
};
