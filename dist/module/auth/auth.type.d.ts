import { z } from "zod";
export declare const registerUserSchema: z.ZodObject<{
    fullName: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    clientToken: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const loginUserSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    clientToken: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const googleLoginSchema: z.ZodObject<{
    email: z.ZodString;
    fullName: z.ZodString;
    providerId: z.ZodString;
    avatarUrl: z.ZodOptional<z.ZodString>;
    clientToken: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const nextAuthSessionSchema: z.ZodObject<{
    nextAuthSecret: z.ZodString;
    nextAuthExpiresAt: z.ZodDate;
    isLoggedIn: z.ZodDefault<z.ZodBoolean>;
    lastLoginAt: z.ZodDate;
    provider: z.ZodString;
    providerId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const changePasswordSchema: z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
}, z.core.$strip>;
export declare const updateProfileSchema: z.ZodObject<{
    avatarUrl: z.ZodOptional<z.ZodString>;
    designation: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    country: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    stateOrRegion: z.ZodOptional<z.ZodString>;
    postCode: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const userQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>, z.ZodNumber>>>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>, z.ZodNumber>>>;
    search: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodEnum<{
        ADMIN: "ADMIN";
        USER: "USER";
    }>>;
    isBanned: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<boolean, string>>>;
    isTrashed: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<boolean, string>>>;
    isLoggedIn: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<boolean, string>>>;
    sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        fullName: "fullName";
        email: "email";
        createdAt: "createdAt";
        updatedAt: "updatedAt";
        lastLoginAt: "lastLoginAt";
    }>>>;
    sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>>;
}, z.core.$strip>;
export declare const userIdSchema: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export declare const sessionValidationSchema: z.ZodObject<{
    nextAuthSecret: z.ZodString;
}, z.core.$strip>;
export declare const verifyOtpSchema: z.ZodObject<{
    email: z.ZodString;
    otp: z.ZodString;
}, z.core.$strip>;
export declare const resendOtpSchema: z.ZodObject<{
    email: z.ZodString;
}, z.core.$strip>;
export declare const requestPasswordResetSchema: z.ZodObject<{
    email: z.ZodString;
}, z.core.$strip>;
export declare const verifyPasswordResetOtpSchema: z.ZodObject<{
    email: z.ZodString;
    otp: z.ZodString;
}, z.core.$strip>;
export declare const resetPasswordWithOtpSchema: z.ZodObject<{
    email: z.ZodString;
    otp: z.ZodString;
    newPassword: z.ZodString;
}, z.core.$strip>;
export declare const logoutSchema: z.ZodObject<{
    nextAuthSecret: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=auth.type.d.ts.map