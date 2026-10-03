"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newArrivalsQuerySchema = exports.templateQuerySchema = exports.templateIdSchema = exports.updateTemplateSchema = exports.createTemplateSchema = void 0;
const zod_1 = require("zod");
exports.createTemplateSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, "Title is required").max(200, "Title must not exceed 200 characters"),
    price: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).transform((val) => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        if (isNaN(num))
            throw new Error("Price must be a valid number");
        return num;
    }).pipe(zod_1.z.number().positive("Price must be positive")),
    lemonsqueezyProductId: zod_1.z.string().optional(),
    lemonsqueezyVariantId: zod_1.z.string().optional(),
    lemonsqueezyPermalink: zod_1.z.string().url().optional(),
    imageUrl: zod_1.z.string().url().optional(),
    screenshots: zod_1.z.array(zod_1.z.string().url()).optional(),
    previewLink: zod_1.z.string().url().optional(),
    sourceFiles: zod_1.z.array(zod_1.z.string()).optional(),
    shortDescription: zod_1.z.string().min(1, "Short description is required").max(500, "Short description must not exceed 500 characters"),
    description: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).transform((val) => {
        if (typeof val === 'string') {
            return val.split('\n').filter(item => item.trim() !== '');
        }
        return val;
    }).optional(),
    whatsIncluded: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).transform((val) => {
        if (typeof val === 'string') {
            return val.split('\n').filter(item => item.trim() !== '');
        }
        return val;
    }).optional(),
    keyFeatures: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.object({
            title: zod_1.z.string(),
            description: zod_1.z.string()
        }))]).transform((val) => {
        if (typeof val === 'string') {
            try {
                return JSON.parse(val);
            }
            catch {
                return [];
            }
        }
        return val;
    }).optional(),
    version: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).transform((val) => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        if (isNaN(num))
            throw new Error("Version must be a valid number");
        return num;
    }).pipe(zod_1.z.number().positive("Version must be positive")).default(1.0),
    pages: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).transform((val) => {
        const num = typeof val === 'string' ? parseInt(val) : val;
        if (isNaN(num))
            throw new Error("Pages must be a valid number");
        return num;
    }).pipe(zod_1.z.number().int().positive("Pages must be positive")).default(1),
    categoryId: zod_1.z.string().uuid("Invalid category ID"),
    categoryName: zod_1.z.string().optional(),
    checkoutUrl: zod_1.z.string().url().optional(),
});
exports.updateTemplateSchema = exports.createTemplateSchema.partial();
exports.templateIdSchema = zod_1.z.object({
    id: zod_1.z.string().uuid("Invalid template ID"),
});
exports.templateQuerySchema = zod_1.z.object({
    page: zod_1.z.string().transform(Number).pipe(zod_1.z.number().int().positive()).default(1),
    limit: zod_1.z.string().transform(Number).pipe(zod_1.z.number().int().positive().max(100)).default(10),
    search: zod_1.z.string().optional(),
    categoryId: zod_1.z.string().uuid().optional(),
    sortBy: zod_1.z.enum(["title", "price", "createdAt", "downloads", "totalPurchase"]).default("createdAt"),
    sortOrder: zod_1.z.enum(["asc", "desc"]).default("desc"),
    minPrice: zod_1.z.string().transform(Number).pipe(zod_1.z.number().positive()).optional(),
    maxPrice: zod_1.z.string().transform(Number).pipe(zod_1.z.number().positive()).optional(),
});
exports.newArrivalsQuerySchema = zod_1.z.object({
    limit: zod_1.z.string().transform(Number).pipe(zod_1.z.number().int().positive().max(50)).default(20),
});
//# sourceMappingURL=template.type.js.map