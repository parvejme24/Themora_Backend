import { z } from "zod";

// Register user schema (supports fullName or name)
export const registerUserSchema = z
  .object({
    fullName: z.string().min(2, "Full name must be at least 2 characters").max(100, "Full name must be less than 100 characters").optional(),
    name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must be less than 100 characters").optional(),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters").max(100, "Password must be less than 100 characters"),
    clientToken: z.string().min(10, "clientToken must be at least 10 characters").optional(),
  })
  .refine((data) => Boolean(data.fullName || data.name), {
    message: "Full name or name is required",
    path: ["name"],
  });

// Login user schema
export const loginUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  clientToken: z.string().min(10).optional(),
});

// Google OAuth login schema
export const googleLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  providerId: z.string().min(1, "Provider ID is required"),
  avatarUrl: z.string().url("Invalid avatar URL").optional(),
  clientToken: z.string().min(10).optional(),
});

// NextAuth session schema
export const nextAuthSessionSchema = z.object({
  nextAuthSecret: z.string().min(1, "NextAuth secret is required"),
  nextAuthExpiresAt: z.date(),
  isLoggedIn: z.boolean().default(true),
  lastLoginAt: z.date(),
  provider: z.string().min(1, "Provider is required"),
  providerId: z.string().optional(),
});

// Change password schema
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters").max(100, "New password must be less than 100 characters"),
});

// Update profile schema (supports name/fullName, avatarUrl, address, phone, etc.)
export const updateProfileSchema = z.object({
  name: z.string().max(100, "Name must be less than 100 characters").optional(),
  fullName: z.string().max(100, "Full name must be less than 100 characters").optional(),
  avatarUrl: z.string().url("Invalid avatar URL").optional().or(z.literal("")),
  designation: z.string().max(100, "Designation must be less than 100 characters").optional(),
  phone: z.string().max(20, "Phone must be less than 20 characters").optional(),
  address: z.string().max(200, "Address must be less than 200 characters").optional(),
  country: z.string().max(50, "Country must be less than 50 characters").optional(),
  city: z.string().max(50, "City must be less than 50 characters").optional(),
  stateOrRegion: z.string().max(50, "State or region must be less than 50 characters").optional(),
  postCode: z.string().max(20, "Post code must be less than 20 characters").optional(),
});

// User query schema
export const userQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).optional().default(1),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional().default(10),
  search: z.string().optional(),
  role: z.enum(['ADMIN', 'USER']).optional(),
  isBanned: z.string().transform(val => val === 'true').optional(),
  isTrashed: z.string().transform(val => val === 'true').optional(),
  isLoggedIn: z.string().transform(val => val === 'true').optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'lastLoginAt', 'fullName', 'email']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// User ID parameter schema
export const userIdSchema = z.object({
  id: z.string().uuid("Invalid user ID"),
});

// Session validation schema
export const sessionValidationSchema = z.object({
  nextAuthSecret: z.string().min(1, "NextAuth secret is required"),
});

// OTP schemas
export const verifyOtpSchema = z.object({
  email: z.string().email("Invalid email address"),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

export const resendOtpSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const requestPasswordResetSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const verifyPasswordResetOtpSchema = verifyOtpSchema;

export const resetPasswordWithOtpSchema = z.object({
  email: z.string().email("Invalid email address"),
  otp: z.string().length(6, "OTP must be 6 digits"),
  newPassword: z.string().min(6, "Password must be at least 6 characters").max(100, "Password must be less than 100 characters"),
});

// Logout schema
export const logoutSchema = z.object({
  nextAuthSecret: z.string().min(1).optional(),
  token: z.string().min(1).optional(),
}).optional();

// Change user role schema
export const changeUserRoleSchema = z.object({
  role: z.enum(["ADMIN", "USER"]),
});
