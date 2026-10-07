export declare const cloudinaryHealthCheck: () => Promise<{
    ok: boolean;
    message: string;
}>;
export declare const debugCloudinaryConfig: () => void;
export declare const uploadCategoryImageCloudinary: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const uploadBlogImageCloudinary: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const uploadAvatarImageCloudinary: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const getUploadedFile: (req: any) => Express.Multer.File | undefined;
export declare const uploadTemplateImageCloudinary: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const uploadImageMemory: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const uploadBufferToCloudinary: (file: Express.Multer.File, folder?: string) => Promise<{
    url: string;
    publicId: string;
}>;
export declare const uploadArchiveFile: (file: Express.Multer.File, folder?: string) => Promise<{
    url: string;
    publicId: string;
}>;
export declare const handleUploadError: (error: any, req: any, res: any, next: any) => any;
export declare const getFileUrl: (file: any) => string | null;
export declare const deleteCloudinaryFile: (publicId: string) => Promise<boolean>;
export declare const extractPublicId: (url: string) => string | null;
export declare const uploadBuffersToCloudinary: (files: Express.Multer.File[], folder?: string) => Promise<{
    url: string;
    publicId: string;
}[]>;
//# sourceMappingURL=cloudinary-upload.d.ts.map