"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_validate_1 = require("./auth.validate");
const authMiddleware_1 = require("../../middleware/authMiddleware");
const cloudinary_upload_1 = require("../../middleware/cloudinary-upload");
const router = (0, express_1.Router)();
router.post("/auth/register", auth_validate_1.validateRegisterUser, auth_controller_1.registerUser);
router.post("/auth/verify-otp", auth_validate_1.validateVerifyOtp, auth_controller_1.verifyOtp);
router.post("/auth/resend-otp", auth_validate_1.validateResendOtp, auth_controller_1.resendOtp);
router.post("/auth/password-reset/request", auth_validate_1.validateRequestPasswordReset, auth_controller_1.requestPasswordReset);
router.post("/auth/password-reset/verify", auth_validate_1.validatePasswordResetOtp, auth_controller_1.verifyPasswordResetOtp);
router.post("/auth/password-reset/confirm", auth_validate_1.validateResetPasswordWithOtp, auth_controller_1.resetPasswordWithOtp);
router.post("/auth/login", auth_validate_1.validateLoginUser, auth_controller_1.loginUser);
router.post("/auth/google-login", auth_validate_1.validateGoogleLogin, auth_controller_1.googleLogin);
router.post("/auth/validate-session", auth_validate_1.validateSessionValidation, auth_controller_1.validateSession);
router.post("/auth/logout", auth_validate_1.validateLogout, auth_controller_1.logoutUser);
router.post("/auth/change-password", authMiddleware_1.authenticateAndCheckStatus, auth_validate_1.validateChangePassword, auth_controller_1.changePassword);
router.put("/auth/profile", authMiddleware_1.authenticateAndCheckStatus, auth_validate_1.validateUpdateProfile, auth_controller_1.updateProfile);
router.put("/auth/profile/avatar", authMiddleware_1.authenticateAndCheckStatus, (req, res, next) => {
    cloudinary_upload_1.uploadImageMemory(req, res, (err) => {
        if (err)
            return (0, cloudinary_upload_1.handleUploadError)(err, req, res, next);
        return next();
    });
}, auth_controller_1.updateAvatarImage);
router.get("/auth/me", authMiddleware_1.authenticateAndCheckStatus, auth_controller_1.getCurrentUser);
router.get("/auth/users", authMiddleware_1.authenticateAdminAndCheckStatus, auth_validate_1.validateUserQuery, auth_controller_1.getAllUsers);
router.get("/auth/users/stats", authMiddleware_1.authenticateAdminAndCheckStatus, auth_controller_1.getUserStats);
router.get("/auth/users/:id", authMiddleware_1.authenticateAdminAndCheckStatus, auth_validate_1.validateUserId, auth_controller_1.getUserById);
router.delete("/auth/users/:id", authMiddleware_1.authenticateAdminAndCheckStatus, auth_validate_1.validateUserId, auth_controller_1.deleteUser);
router.patch("/auth/users/:id/ban", authMiddleware_1.authenticateAdminAndCheckStatus, auth_validate_1.validateUserId, auth_controller_1.banUser);
router.patch("/auth/users/:id/unban", authMiddleware_1.authenticateAdminAndCheckStatus, auth_validate_1.validateUserId, auth_controller_1.unbanUser);
router.patch("/auth/users/:id/trash", authMiddleware_1.authenticateAdminAndCheckStatus, auth_validate_1.validateUserId, auth_controller_1.trashUser);
router.patch("/auth/users/:id/restore", authMiddleware_1.authenticateAdminAndCheckStatus, auth_validate_1.validateUserId, auth_controller_1.restoreUser);
router.patch("/auth/users/:id/role", authMiddleware_1.authenticateAdminAndCheckStatus, auth_validate_1.validateUserId, auth_controller_1.changeUserRole);
exports.default = router;
//# sourceMappingURL=auth.route.js.map