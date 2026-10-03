import { Request, Response } from "express";
import { authService } from "./auth.service";
import { IUserQuery } from "./auth.interface";
import { uploadBufferToCloudinary } from "../../middleware/cloudinary-upload";

// Register new user
export const registerUser = async (req: Request, res: Response) => {
  try {
    const result = await authService.registerUser(req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error("Error in register controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Login user
export const loginUser = async (req: Request, res: Response) => {
  try {
    const result = await authService.loginUser(req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in login controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Google OAuth login
export const googleLogin = async (req: Request, res: Response) => {
  try {
    const result = await authService.googleLogin(req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in Google login controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Verify OTP
export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const result = await authService.verifyOtp(req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in verify OTP controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Resend OTP
export const resendOtp = async (req: Request, res: Response) => {
  try {
    const result = await authService.resendOtp(req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in resend OTP controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const requestPasswordReset = async (req: Request, res: Response) => {
  const result = await authService.requestPasswordReset(req.body.email);
  return res.status(result.success ? 200 : result.error === "Email delivery failed" ? 503 : 500).json(result);
};

export const verifyPasswordResetOtp = async (req: Request, res: Response) => {
  const result = await authService.verifyPasswordResetOtp(req.body);
  return res.status(result.success ? 200 : 400).json(result);
};

export const resetPasswordWithOtp = async (req: Request, res: Response) => {
  const result = await authService.resetPasswordWithOtp(req.body);
  return res.status(result.success ? 200 : result.error === "Password reset failed" ? 500 : 400).json(result);
};

// Validate session
export const validateSession = async (req: Request, res: Response) => {
  try {
    const { nextAuthSecret } = req.body;
    const result = await authService.validateSession(nextAuthSecret);

    if (!result.isValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid session",
        error: result.error,
      });
    }

    // Sanitize user: remove sensitive fields before sending to client
    const user = (result.user as any) || {};
    const {
      password,
      nextAuthSecret: _nextAuthSecret,
      otpCode,
      otpPurpose,
      otpExpiresAt,
      ...safeUser
    } = user;

    return res.status(200).json({
      success: true,
      message: "Session is valid",
      data: { user: safeUser },
    });
  } catch (error) {
    console.error("Error in validate session controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Logout user
export const logoutUser = async (req: Request, res: Response) => {
  try {
    const { nextAuthSecret } = req.body;
    const result = await authService.logoutUser(nextAuthSecret);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in logout controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Change password
export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "User not authenticated",
      });
    }

    const result = await authService.changePassword(userId, req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in change password controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Update profile
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "User not authenticated",
      });
    }

    const result = await authService.updateProfile(userId, req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in update profile controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Update avatar image via Cloudinary upload
export const updateAvatarImage = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "User not authenticated",
      });
    }

    // Check if file was uploaded via memory storage
    if (!(req as any).file) {
      return res.status(400).json({
        success: false,
        message: "No image uploaded",
        error: "Missing file",
      });
    }

    // Upload buffer to Cloudinary
    const uploaded = await uploadBufferToCloudinary((req as any).file);
    const url = uploaded.url;

    const result = await authService.updateProfile(userId, { avatarUrl: url });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json({
      success: true,
      message: "Avatar updated successfully",
      data: result.data,
    });
  } catch (error) {
    console.error("Error in update avatar controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Update cover image via Cloudinary upload
// (Cover image endpoint removed by request)

// Get current user profile
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "User not authenticated",
      });
    }

    const result = await authService.getUserById(userId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in get current user controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get user by ID (admin only)
export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await authService.getUserById(id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in get user by ID controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get all users (admin only)
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const query: IUserQuery = (req as any).validatedQuery || req.query;
    const result = await authService.getAllUsers(query);

    // Sanitize users: remove sensitive fields
    const sanitizedUsers = result.users.map((user: any) => {
      const {
        password,
        nextAuthSecret,
        otpCode,
        otpPurpose,
        otpExpiresAt,
        ...safeUser
      } = user;
      return safeUser;
    });

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: sanitizedUsers,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error in get all users controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get user statistics (admin only)
export const getUserStats = async (req: Request, res: Response) => {
  try {
    const stats = await authService.getUserStats();

    return res.status(200).json({
      success: true,
      message: "User statistics fetched successfully",
      data: stats,
    });
  } catch (error) {
    console.error("Error in get user stats controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Delete user (admin only)
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await authService.deleteUser(id);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in delete user controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Ban user
export const banUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await authService.updateUser(id, { isBanned: true });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json({
      success: true,
      message: "User banned successfully",
      data: result.data,
    });
  } catch (error) {
    console.error("Error in ban user controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Unban user
export const unbanUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await authService.updateUser(id, { isBanned: false });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json({
      success: true,
      message: "User unbanned successfully",
      data: result.data,
    });
  } catch (error) {
    console.error("Error in unban user controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Trash user
export const trashUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await authService.updateUser(id, { isTrashed: true });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json({
      success: true,
      message: "User moved to trash successfully",
      data: result.data,
    });
  } catch (error) {
    console.error("Error in trash user controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Restore user from trash
export const restoreUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await authService.updateUser(id, { isTrashed: false });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json({
      success: true,
      message: "User restored from trash successfully",
      data: result.data,
    });
  } catch (error) {
    console.error("Error in restore user controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Change user role
export const changeUserRole = async (req: Request, res: Response) => {
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

    const result = await authService.updateUser(id, { role });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json({
      success: true,
      message: `User role changed to ${role} successfully`,
      data: result.data,
    });
  } catch (error) {
    console.error("Error in change user role controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
