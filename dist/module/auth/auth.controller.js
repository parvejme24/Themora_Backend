"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeUserRole = exports.restoreUser = exports.trashUser = exports.unbanUser = exports.banUser = exports.deleteUser = exports.getUserStats = exports.getAllUsers = exports.getUserById = exports.getCurrentUser = exports.updateAvatarImage = exports.updateProfile = exports.changePassword = exports.logoutUser = exports.validateSession = exports.resetPasswordWithOtp = exports.verifyPasswordResetOtp = exports.requestPasswordReset = exports.resendOtp = exports.verifyOtp = exports.googleLogin = exports.loginUser = exports.registerUser = void 0;
const auth_service_1 = require("./auth.service");
const cloudinary_upload_1 = require("../../middleware/cloudinary-upload");
const registerUser = async (req, res) => {
    try {
        const result = await auth_service_1.authService.registerUser(req.body);
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(201).json(result);
    }
    catch (error) {
        console.error("Error in register controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.registerUser = registerUser;
const loginUser = async (req, res) => {
    try {
        const result = await auth_service_1.authService.loginUser(req.body);
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(200).json(result);
    }
    catch (error) {
        console.error("Error in login controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.loginUser = loginUser;
const googleLogin = async (req, res) => {
    try {
        const result = await auth_service_1.authService.googleLogin(req.body);
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(200).json(result);
    }
    catch (error) {
        console.error("Error in Google login controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.googleLogin = googleLogin;
const verifyOtp = async (req, res) => {
    try {
        const result = await auth_service_1.authService.verifyOtp(req.body);
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(200).json(result);
    }
    catch (error) {
        console.error("Error in verify OTP controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.verifyOtp = verifyOtp;
const resendOtp = async (req, res) => {
    try {
        const result = await auth_service_1.authService.resendOtp(req.body);
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(200).json(result);
    }
    catch (error) {
        console.error("Error in resend OTP controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.resendOtp = resendOtp;
const requestPasswordReset = async (req, res) => {
    const result = await auth_service_1.authService.requestPasswordReset(req.body.email);
    return res.status(result.success ? 200 : result.error === "Email delivery failed" ? 503 : 500).json(result);
};
exports.requestPasswordReset = requestPasswordReset;
const verifyPasswordResetOtp = async (req, res) => {
    const result = await auth_service_1.authService.verifyPasswordResetOtp(req.body);
    return res.status(result.success ? 200 : 400).json(result);
};
exports.verifyPasswordResetOtp = verifyPasswordResetOtp;
const resetPasswordWithOtp = async (req, res) => {
    const result = await auth_service_1.authService.resetPasswordWithOtp(req.body);
    return res.status(result.success ? 200 : result.error === "Password reset failed" ? 500 : 400).json(result);
};
exports.resetPasswordWithOtp = resetPasswordWithOtp;
const validateSession = async (req, res) => {
    try {
        const { nextAuthSecret } = req.body;
        const result = await auth_service_1.authService.validateSession(nextAuthSecret);
        if (!result.isValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid session",
                error: result.error,
            });
        }
        const user = result.user || {};
        const { password, nextAuthSecret: _nextAuthSecret, otpCode, otpPurpose, otpExpiresAt, ...safeUser } = user;
        return res.status(200).json({
            success: true,
            message: "Session is valid",
            data: { user: safeUser },
        });
    }
    catch (error) {
        console.error("Error in validate session controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.validateSession = validateSession;
const logoutUser = async (req, res) => {
    try {
        const { nextAuthSecret } = req.body;
        const result = await auth_service_1.authService.logoutUser(nextAuthSecret);
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(200).json(result);
    }
    catch (error) {
        console.error("Error in logout controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.logoutUser = logoutUser;
const changePassword = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
                error: "User not authenticated",
            });
        }
        const result = await auth_service_1.authService.changePassword(userId, req.body);
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(200).json(result);
    }
    catch (error) {
        console.error("Error in change password controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.changePassword = changePassword;
const updateProfile = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
                error: "User not authenticated",
            });
        }
        const result = await auth_service_1.authService.updateProfile(userId, req.body);
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(200).json(result);
    }
    catch (error) {
        console.error("Error in update profile controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.updateProfile = updateProfile;
const updateAvatarImage = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
                error: "User not authenticated",
            });
        }
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No image uploaded",
                error: "Missing file",
            });
        }
        const uploaded = await (0, cloudinary_upload_1.uploadBufferToCloudinary)(req.file);
        const url = uploaded.url;
        const result = await auth_service_1.authService.updateProfile(userId, { avatarUrl: url });
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(200).json({
            success: true,
            message: "Avatar updated successfully",
            data: result.data,
        });
    }
    catch (error) {
        console.error("Error in update avatar controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.updateAvatarImage = updateAvatarImage;
const getCurrentUser = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
                error: "User not authenticated",
            });
        }
        const result = await auth_service_1.authService.getUserById(userId);
        if (!result.success) {
            return res.status(404).json(result);
        }
        return res.status(200).json(result);
    }
    catch (error) {
        console.error("Error in get current user controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getCurrentUser = getCurrentUser;
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await auth_service_1.authService.getUserById(id);
        if (!result.success) {
            return res.status(404).json(result);
        }
        return res.status(200).json(result);
    }
    catch (error) {
        console.error("Error in get user by ID controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getUserById = getUserById;
const getAllUsers = async (req, res) => {
    try {
        const query = req.validatedQuery || req.query;
        const result = await auth_service_1.authService.getAllUsers(query);
        const sanitizedUsers = result.users.map((user) => {
            const { password, nextAuthSecret, otpCode, otpPurpose, otpExpiresAt, ...safeUser } = user;
            return safeUser;
        });
        return res.status(200).json({
            success: true,
            message: "Users fetched successfully",
            data: sanitizedUsers,
            pagination: result.pagination,
        });
    }
    catch (error) {
        console.error("Error in get all users controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getAllUsers = getAllUsers;
const getUserStats = async (req, res) => {
    try {
        const stats = await auth_service_1.authService.getUserStats();
        return res.status(200).json({
            success: true,
            message: "User statistics fetched successfully",
            data: stats,
        });
    }
    catch (error) {
        console.error("Error in get user stats controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getUserStats = getUserStats;
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await auth_service_1.authService.deleteUser(id);
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(200).json(result);
    }
    catch (error) {
        console.error("Error in delete user controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.deleteUser = deleteUser;
const banUser = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await auth_service_1.authService.updateUser(id, { isBanned: true });
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(200).json({
            success: true,
            message: "User banned successfully",
            data: result.data,
        });
    }
    catch (error) {
        console.error("Error in ban user controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.banUser = banUser;
const unbanUser = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await auth_service_1.authService.updateUser(id, { isBanned: false });
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(200).json({
            success: true,
            message: "User unbanned successfully",
            data: result.data,
        });
    }
    catch (error) {
        console.error("Error in unban user controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.unbanUser = unbanUser;
const trashUser = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await auth_service_1.authService.updateUser(id, { isTrashed: true });
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(200).json({
            success: true,
            message: "User moved to trash successfully",
            data: result.data,
        });
    }
    catch (error) {
        console.error("Error in trash user controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.trashUser = trashUser;
const restoreUser = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await auth_service_1.authService.updateUser(id, { isTrashed: false });
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(200).json({
            success: true,
            message: "User restored from trash successfully",
            data: result.data,
        });
    }
    catch (error) {
        console.error("Error in restore user controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.restoreUser = restoreUser;
const changeUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        if (!role || !["ADMIN", "USER"].includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Invalid role. Must be ADMIN or USER",
                error: "Invalid role",
            });
        }
        const result = await auth_service_1.authService.updateUser(id, { role });
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(200).json({
            success: true,
            message: `User role changed to ${role} successfully`,
            data: result.data,
        });
    }
    catch (error) {
        console.error("Error in change user role controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.changeUserRole = changeUserRole;
//# sourceMappingURL=auth.controller.js.map