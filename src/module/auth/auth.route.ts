import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  registerUser,
  loginUser,
  googleLogin,
  verifyOtp,
  resendOtp,
  requestPasswordReset,
  verifyPasswordResetOtp,
  resetPasswordWithOtp,
  validateSession,
  logoutUser,
  changePassword,
  updateProfile,
  updateAvatarImage,
  removeAvatarImage,
  getCurrentUser,
  getUserById,
  getAllUsers,
  getUserStats,
  deleteUser,
  banUser,
  unbanUser,
  trashUser,
  restoreUser,
  changeUserRole,
} from "./auth.controller";
import {
  validateRegisterUser,
  validateLoginUser,
  validateGoogleLogin,
  validateVerifyOtp,
  validateResendOtp,
  validateRequestPasswordReset,
  validatePasswordResetOtp,
  validateResetPasswordWithOtp,
  validateChangePassword,
  validateUpdateProfile,
  validateUserQuery,
  validateUserId,
  validateSessionValidation,
  validateLogout,
  validateChangeUserRole,
} from "./auth.validate";
import {
  authenticateAndCheckStatus,
  authenticateAdminAndCheckStatus,
} from "../../middleware/authMiddleware";
import { uploadAvatarImageCloudinary, handleUploadError } from "../../middleware/cloudinary-upload";
import { Request, Response, NextFunction } from "express";

// Slows down password guessing and OTP brute force (per IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skip: () => process.env.NODE_ENV === "test",
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Please wait 15 minutes and try again" },
});

const router = Router();

// Public routes (no authentication required)
router.post("/auth/register", authLimiter, validateRegisterUser, registerUser);
router.post("/auth/verify-otp", authLimiter, validateVerifyOtp, verifyOtp);
router.post("/auth/resend-otp", authLimiter, validateResendOtp, resendOtp);
router.post("/auth/password-reset/request", authLimiter, validateRequestPasswordReset, requestPasswordReset);
router.post("/auth/password-reset/verify", authLimiter, validatePasswordResetOtp, verifyPasswordResetOtp);
router.post("/auth/password-reset/confirm", authLimiter, validateResetPasswordWithOtp, resetPasswordWithOtp);
router.post("/auth/login", authLimiter, validateLoginUser, loginUser);
router.post("/auth/google-login", authLimiter, validateGoogleLogin, googleLogin);
router.post("/auth/google", authLimiter, validateGoogleLogin, googleLogin);
router.post("/auth/validate-session", validateSessionValidation, validateSession);
router.post("/auth/logout", validateLogout, logoutUser);

// Protected routes (authentication required)
router.post("/auth/change-password", authenticateAndCheckStatus, validateChangePassword, changePassword);

// Update profile (accepts JSON or multipart/form-data with optional avatar image)
router.put(
  "/auth/profile",
  authenticateAndCheckStatus,
  (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.headers["content-type"] || "";
    if (contentType.includes("multipart/form-data")) {
      (uploadAvatarImageCloudinary as any)(req, res, (err: any) => {
        if (err) return handleUploadError(err, req, res, next);
        return next();
      });
    } else {
      return next();
    }
  },
  validateUpdateProfile,
  updateProfile
);

// Explicit avatar update endpoint
router.put(
  "/auth/profile/avatar",
  authenticateAndCheckStatus,
  (req: Request, res: Response, next: NextFunction) => {
    (uploadAvatarImageCloudinary as any)(req, res, (err: any) => {
      if (err) return handleUploadError(err, req, res, next);
      return next();
    });
  },
  updateAvatarImage
);
router.delete("/auth/profile/avatar", authenticateAndCheckStatus, removeAvatarImage);

router.get("/auth/me", authenticateAndCheckStatus, getCurrentUser);

// Admin routes (admin authentication required)
router.get("/auth/users", authenticateAdminAndCheckStatus, validateUserQuery, getAllUsers);
router.get("/auth/users/stats", authenticateAdminAndCheckStatus, getUserStats);
router.get("/auth/users/:id", authenticateAdminAndCheckStatus, validateUserId, getUserById);
router.delete("/auth/users/:id", authenticateAdminAndCheckStatus, validateUserId, deleteUser);

// Specific admin user management routes
router.patch("/auth/users/:id/ban", authenticateAdminAndCheckStatus, validateUserId, banUser);
router.patch("/auth/users/:id/unban", authenticateAdminAndCheckStatus, validateUserId, unbanUser);
router.patch("/auth/users/:id/trash", authenticateAdminAndCheckStatus, validateUserId, trashUser);
router.patch("/auth/users/:id/restore", authenticateAdminAndCheckStatus, validateUserId, restoreUser);
router.patch("/auth/users/:id/role", authenticateAdminAndCheckStatus, validateUserId, validateChangeUserRole, changeUserRole);
router.put("/auth/users/:id/role", authenticateAdminAndCheckStatus, validateUserId, validateChangeUserRole, changeUserRole);

export default router;