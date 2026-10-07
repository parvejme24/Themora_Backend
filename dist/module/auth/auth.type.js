"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeUserRoleSchema = exports.logoutSchema = exports.resetPasswordWithOtpSchema = exports.verifyPasswordResetOtpSchema = exports.requestPasswordResetSchema = exports.resendOtpSchema = exports.verifyOtpSchema = exports.sessionValidationSchema = exports.userIdSchema = exports.userQuerySchema = exports.updateProfileSchema = exports.changePasswordSchema = exports.nextAuthSessionSchema = exports.googleLoginSchema = exports.loginUserSchema = exports.registerUserSchema = void 0;
const zod_1 = require("zod");
exports.registerUserSchema = zod_1.z
    .object({
    fullName: zod_1.z.string().min(2, "Full name must be at least 2 characters").max(100, "Full name must be less than 100 characters").optional(),
    name: zod_1.z.string().min(2, "Name must be at least 2 characters").max(100, "Name must be less than 100 characters").optional(),
    email: zod_1.z.string().email("Invalid email address"),
    password: zod_1.z.string().min(6, "Password must be at least 6 characters").max(100, "Password must be less than 100 characters"),
    clientToken: zod_1.z.string().min(10, "clientToken must be at least 10 characters").optional(),
})
    .refine((data) => Boolean(data.fullName || data.name), {
    message: "Full name or name is required",
    path: ["name"],
});
exports.loginUserSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email address"),
    password: zod_1.z.string().min(1, "Password is required"),
    clientToken: zod_1.z.string().min(10).optional(),
});
exports.googleLoginSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email address"),
    fullName: zod_1.z.string().min(2, "Full name must be at least 2 characters"),
    providerId: zod_1.z.string().min(1, "Provider ID is required"),
    avatarUrl: zod_1.z.string().url("Invalid avatar URL").optional(),
    clientToken: zod_1.z.string().min(10).optional(),
});
exports.nextAuthSessionSchema = zod_1.z.object({
    nextAuthSecret: zod_1.z.string().min(1, "NextAuth secret is required"),
    nextAuthExpiresAt: zod_1.z.date(),
    isLoggedIn: zod_1.z.boolean().default(true),
    lastLoginAt: zod_1.z.date(),
    provider: zod_1.z.string().min(1, "Provider is required"),
    providerId: zod_1.z.string().optional(),
});
exports.changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1, "Current password is required"),
    newPassword: zod_1.z.string().min(6, "New password must be at least 6 characters").max(100, "New password must be less than 100 characters"),
});
exports.updateProfileSchema = zod_1.z.object({
    name: zod_1.z.string().max(100, "Name must be less than 100 characters").optional(),
    fullName: zod_1.z.string().max(100, "Full name must be less than 100 characters").optional(),
    avatarUrl: zod_1.z.string().url("Invalid avatar URL").optional().or(zod_1.z.literal("")),
    designation: zod_1.z.string().max(100, "Designation must be less than 100 characters").optional(),
    phone: zod_1.z.string().max(20, "Phone must be less than 20 characters").optional(),
    address: zod_1.z.string().max(200, "Address must be less than 200 characters").optional(),
    country: zod_1.z.string().max(50, "Country must be less than 50 characters").optional(),
    city: zod_1.z.string().max(50, "City must be less than 50 characters").optional(),
    stateOrRegion: zod_1.z.string().max(50, "State or region must be less than 50 characters").optional(),
    postCode: zod_1.z.string().max(20, "Post code must be less than 20 characters").optional(),
});
exports.userQuerySchema = zod_1.z.object({
    page: zod_1.z.string().transform(Number).pipe(zod_1.z.number().min(1)).optional().default(1),
    limit: zod_1.z.string().transform(Number).pipe(zod_1.z.number().min(1).max(100)).optional().default(10),
    search: zod_1.z.string().optional(),
    role: zod_1.z.enum(['ADMIN', 'USER']).optional(),
    isBanned: zod_1.z.string().transform(val => val === 'true').optional(),
    isTrashed: zod_1.z.string().transform(val => val === 'true').optional(),
    isLoggedIn: zod_1.z.string().transform(val => val === 'true').optional(),
    sortBy: zod_1.z.enum(['createdAt', 'updatedAt', 'lastLoginAt', 'fullName', 'email']).optional().default('createdAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('desc'),
});
exports.userIdSchema = zod_1.z.object({
    id: zod_1.z.string().uuid("Invalid user ID"),
});
exports.sessionValidationSchema = zod_1.z.object({
    nextAuthSecret: zod_1.z.string().min(1, "NextAuth secret is required"),
});
exports.verifyOtpSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email address"),
    otp: zod_1.z.string().length(6, "OTP must be 6 digits"),
});
exports.resendOtpSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email address"),
});
exports.requestPasswordResetSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email address"),
});
exports.verifyPasswordResetOtpSchema = exports.verifyOtpSchema;
exports.resetPasswordWithOtpSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email address"),
    otp: zod_1.z.string().length(6, "OTP must be 6 digits"),
    newPassword: zod_1.z.string().min(6, "Password must be at least 6 characters").max(100, "Password must be less than 100 characters"),
});
exports.logoutSchema = zod_1.z.object({
    nextAuthSecret: zod_1.z.string().min(1).optional(),
    token: zod_1.z.string().min(1).optional(),
}).optional();
exports.changeUserRoleSchema = zod_1.z.object({
    role: zod_1.z.enum(["ADMIN", "USER"]),
});
//# sourceMappingURL=auth.type.js.map