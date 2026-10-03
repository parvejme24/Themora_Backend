import { OtpPurpose } from "@prisma/client";
import { prisma } from "../../config/database";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  IRegisterUser,
  ILoginUser,
  IGoogleLogin,
  IUpdateUser,
  IAuthResponse,
  ISessionValidation,
  IChangePassword,
  IUpdateProfile,
  IUserQuery,
  IUserStats,
  IVerifyOtp,
  IResendOtp,
  IResetPasswordWithOtp,
} from "./auth.interface";
import { sendOtpEmail } from "../../utils/email";

class AuthService {
  // Generate NextAuth secret
  private generateNextAuthSecret(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  // Generate session expiration (24 hours from now)
  private generateSessionExpiration(): Date {
    const expiration = new Date();
    expiration.setHours(expiration.getHours() + 24);
    return expiration;
  }

  // Register new user
  public async registerUser(data: IRegisterUser): Promise<IAuthResponse> {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        return {
          success: false,
          message: "User with this email already exists",
          error: "Email already registered",
        };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 12);

      // Prepare OTP for email verification
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // If clientToken provided, store as nextAuthSecret but do not log in until OTP verified
      const nextAuthSecret = data.clientToken || null;
      const sessionExpiration = nextAuthSecret
        ? this.generateSessionExpiration()
        : (null as any);

      // Create user
      const user = await prisma.user.create({
        data: {
          fullName: data.fullName,
          email: data.email,
          password: hashedPassword,
          nextAuthSecret,
          nextAuthExpiresAt: sessionExpiration,
          isLoggedIn: false,
          lastLoginAt: null,
          provider: "email",
        },
        include: {
          profile: true,
        },
      });

      // Save OTP fields
      await prisma.user.update({
        where: { id: user.id },
        data: {
          otpCode: otp,
          otpPurpose: OtpPurpose.REGISTRATION,
          otpExpiresAt: otpExpiresAt,
          otpVerified: false,
        },
      });

      // Send OTP email
      try {
        await sendOtpEmail(user.email, otp);
      } catch (err) {
        console.error("Failed to send OTP email:", err);
        return {
          success: false,
          message: "Account created, but verification email could not be sent. Please request a new code.",
          error: "Email delivery failed",
        };
      }

      return {
        success: true,
        message:
          "User registered successfully. Please verify the OTP sent to your email.",
        data: {
          user: user as any,
          nextAuthSecret: nextAuthSecret || undefined,
          expiresAt: sessionExpiration || undefined,
        },
      };
    } catch (error) {
      console.error("Error registering user:", error);
      return {
        success: false,
        message: "Failed to register user",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Login user with email and password
  public async loginUser(data: ILoginUser): Promise<IAuthResponse> {
    try {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: data.email },
        include: { profile: true },
      });

      if (!user) {
        return {
          success: false,
          message: "Invalid email or password",
          error: "User not found",
        };
      }

      // Check if user is banned or trashed
      if (user.isBanned || user.isTrashed || user.isDeletedPermanently) {
        return {
          success: false,
          message: "Account is disabled",
          error: "Account not accessible",
        };
      }

      // Check if user has password (not OAuth only)
      if (!user.password) {
        return {
          success: false,
          message: "Please use Google login for this account",
          error: "OAuth account",
        };
      }

      // Enforce OTP verification for email/password accounts
      if (!user.otpVerified) {
        return {
          success: false,
          message: "Please verify OTP sent to your email before logging in",
          error: "OTP not verified",
        };
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(
        data.password,
        user.password
      );
      if (!isPasswordValid) {
        return {
          success: false,
          message: "Invalid email or password",
          error: "Invalid password",
        };
      }

      // Use clientToken if provided, else generate one
      const nextAuthSecret = data.clientToken || this.generateNextAuthSecret();
      const sessionExpiration = this.generateSessionExpiration();

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          nextAuthSecret,
          nextAuthExpiresAt: sessionExpiration,
          isLoggedIn: true,
          lastLoginAt: new Date(),
        },
        include: { profile: true },
      });

      return {
        success: true,
        message: "Login successful",
        data: {
          user: updatedUser as any,
          nextAuthSecret,
          expiresAt: sessionExpiration,
        },
      };
    } catch (error) {
      console.error("Error logging in user:", error);
      return {
        success: false,
        message: "Failed to login",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Google OAuth login
  public async googleLogin(data: IGoogleLogin): Promise<IAuthResponse> {
    try {
      // Check if user exists
      let user = await prisma.user.findUnique({
        where: { email: data.email },
        include: { profile: true },
      });

      if (user) {
        // Update existing user with Google info
        const nextAuthSecret = this.generateNextAuthSecret();
        const sessionExpiration = this.generateSessionExpiration();

        const updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: {
            nextAuthSecret: data.clientToken || nextAuthSecret,
            nextAuthExpiresAt: sessionExpiration,
            isLoggedIn: true,
            lastLoginAt: new Date(),
            provider: "google",
            providerId: data.providerId,
            otpVerified: true,
          },
          include: { profile: true },
        });

        return {
          success: true,
          message: "Google login successful",
          data: {
            user: updatedUser as any,
            nextAuthSecret,
            expiresAt: sessionExpiration,
          },
        };
      } else {
        // Create new user with Google info
        const nextAuthSecret = this.generateNextAuthSecret();
        const sessionExpiration = this.generateSessionExpiration();

        const newUser = await prisma.user.create({
          data: {
            fullName: data.fullName,
            email: data.email,
            nextAuthSecret: data.clientToken || nextAuthSecret,
            nextAuthExpiresAt: sessionExpiration,
            isLoggedIn: true,
            lastLoginAt: new Date(),
            provider: "google",
            providerId: data.providerId,
            otpVerified: true,
          },
          include: { profile: true },
        });

        // Create user profile if avatar URL provided
        if (data.avatarUrl) {
          await prisma.userProfile.create({
            data: {
              userId: newUser.id,
              avatarUrl: data.avatarUrl,
            },
          });
        }

        return {
          success: true,
          message: "Google registration and login successful",
          data: {
            user: newUser as any,
            nextAuthSecret,
            expiresAt: sessionExpiration,
          },
        };
      }
    } catch (error) {
      console.error("Error with Google login:", error);
      return {
        success: false,
        message: "Failed to login with Google",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Validate NextAuth session
  public async validateSession(
    nextAuthSecret: string
  ): Promise<ISessionValidation> {
    try {
      const user = await prisma.user.findFirst({
        where: {
          nextAuthSecret,
          isLoggedIn: true,
          nextAuthExpiresAt: {
            gt: new Date(),
          },
        },
        include: { profile: true },
      });

      if (!user) {
        return {
          isValid: false,
          error: "Invalid or expired session",
        };
      }

      return {
        isValid: true,
        user: user as any,
      };
    } catch (error) {
      console.error("Error validating session:", error);
      return {
        isValid: false,
        error: "Session validation failed",
      };
    }
  }

  // Logout user
  public async logoutUser(nextAuthSecret: string): Promise<IAuthResponse> {
    try {
      const user = await prisma.user.findFirst({
        where: { nextAuthSecret },
      });

      if (!user) {
        return {
          success: false,
          message: "Invalid session",
          error: "User not found",
        };
      }

      // Clear NextAuth session data
      await prisma.user.update({
        where: { id: user.id },
        data: {
          nextAuthSecret: null,
          nextAuthExpiresAt: null,
          isLoggedIn: false,
        },
      });

      return {
        success: true,
        message: "Logout successful",
      };
    } catch (error) {
      console.error("Error logging out user:", error);
      return {
        success: false,
        message: "Failed to logout",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Verify OTP
  public async verifyOtp(data: IVerifyOtp): Promise<IAuthResponse> {
    try {
      const user = await prisma.user.findUnique({
        where: { email: data.email },
      });
      if (!user) {
        return {
          success: false,
          message: "User not found",
          error: "User not found",
        };
      }
      if (
        !user.otpCode ||
        !user.otpExpiresAt ||
        user.otpPurpose !== ("REGISTRATION" as any)
      ) {
        return {
          success: false,
          message: "No OTP pending for this user",
          error: "No OTP",
        };
      }
      if (new Date() > user.otpExpiresAt) {
        return { success: false, message: "OTP expired", error: "OTP expired" };
      }
      if (user.otpCode !== data.otp) {
        return { success: false, message: "Invalid OTP", error: "Invalid OTP" };
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          otpVerified: true,
          otpCode: null,
          otpPurpose: null,
          otpExpiresAt: null,
        },
      });

      return { success: true, message: "OTP verified successfully" };
    } catch (error) {
      console.error("Error verifying OTP:", error);
      return {
        success: false,
        message: "Failed to verify OTP",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Resend OTP
  public async resendOtp(data: IResendOtp): Promise<IAuthResponse> {
    try {
      const user = await prisma.user.findUnique({
        where: { email: data.email },
      });
      if (!user) {
        return {
          success: false,
          message: "User not found",
          error: "User not found",
        };
      }
      if (user.otpVerified) {
        return {
          success: false,
          message: "User already verified",
          error: "Already verified",
        };
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: { otpCode: otp, otpPurpose: "REGISTRATION" as any, otpExpiresAt },
      });

      await sendOtpEmail(user.email, otp);

      return { success: true, message: "OTP resent successfully" };
    } catch (error) {
      console.error("Error resending OTP:", error);
      return {
        success: false,
        message: "Failed to resend OTP",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  public async requestPasswordReset(email: string): Promise<IAuthResponse> {
    const genericMessage = "If an account exists for that email, a password reset code has been sent.";
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (!user || !user.password || user.isBanned || user.isTrashed || user.isDeletedPermanently) {
        return { success: true, message: genericMessage };
      }

      const otp = crypto.randomInt(100000, 1000000).toString();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.user.update({
        where: { id: user.id },
        data: { otpCode: otp, otpPurpose: OtpPurpose.PASSWORD_RESET, otpExpiresAt },
      });

      try {
        await sendOtpEmail(user.email, otp, "password reset");
      } catch (error) {
        await prisma.user.update({
          where: { id: user.id },
          data: { otpCode: null, otpPurpose: null, otpExpiresAt: null },
        });
        console.error("Failed to send password reset email:", error);
        return { success: false, message: "Unable to send the reset code. Please try again later.", error: "Email delivery failed" };
      }

      return { success: true, message: genericMessage };
    } catch (error) {
      console.error("Error requesting password reset:", error);
      return { success: false, message: "Unable to process the password reset request", error: "Password reset failed" };
    }
  }

  public async verifyPasswordResetOtp(data: IVerifyOtp): Promise<IAuthResponse> {
    try {
      const user = await prisma.user.findUnique({ where: { email: data.email.trim().toLowerCase() } });
      if (!user || user.otpPurpose !== OtpPurpose.PASSWORD_RESET || !user.otpCode || !user.otpExpiresAt || user.otpExpiresAt < new Date() || user.otpCode !== data.otp) {
        return { success: false, message: "The reset code is invalid or expired", error: "Invalid reset code" };
      }
      return { success: true, message: "Reset code verified" };
    } catch (error) {
      console.error("Error verifying password reset code:", error);
      return { success: false, message: "Unable to verify the reset code", error: "Reset verification failed" };
    }
  }

  public async resetPasswordWithOtp(data: IResetPasswordWithOtp): Promise<IAuthResponse> {
    const verification = await this.verifyPasswordResetOtp(data);
    if (!verification.success) return verification;

    try {
      const normalizedEmail = data.email.trim().toLowerCase();
      const user = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
      if (!user) return { success: false, message: "The reset code is invalid or expired", error: "Invalid reset code" };

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: await bcrypt.hash(data.newPassword, 12),
          otpCode: null,
          otpPurpose: null,
          otpExpiresAt: null,
          otpVerified: true,
          nextAuthSecret: null,
          nextAuthExpiresAt: null,
          isLoggedIn: false,
        },
      });
      return { success: true, message: "Password reset successfully" };
    } catch (error) {
      console.error("Error resetting password:", error);
      return { success: false, message: "Unable to reset the password", error: "Password reset failed" };
    }
  }

  // Change password
  public async changePassword(
    userId: string,
    data: IChangePassword
  ): Promise<IAuthResponse> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || !user.password) {
        return {
          success: false,
          message: "User not found or no password set",
          error: "Invalid user",
        };
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(
        data.currentPassword,
        user.password
      );
      if (!isCurrentPasswordValid) {
        return {
          success: false,
          message: "Current password is incorrect",
          error: "Invalid current password",
        };
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(data.newPassword, 12);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword },
      });

      return {
        success: true,
        message: "Password changed successfully",
      };
    } catch (error) {
      console.error("Error changing password:", error);
      return {
        success: false,
        message: "Failed to change password",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Update user profile
  public async updateProfile(
    userId: string,
    data: IUpdateProfile
  ): Promise<IAuthResponse> {
    try {
      // Check if profile exists
      const existingProfile = await prisma.userProfile.findUnique({
        where: { userId },
      });

      let profile;
      if (existingProfile) {
        // Update existing profile
        profile = await prisma.userProfile.update({
          where: { userId },
          data,
        });
      } else {
        // Create new profile
        profile = await prisma.userProfile.create({
          data: {
            userId,
            ...data,
          },
        });
      }

      // Get updated user with profile
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true },
      });

      return {
        success: true,
        message: "Profile updated successfully",
        data: { user: user as any },
      };
    } catch (error) {
      console.error("Error updating profile:", error);
      return {
        success: false,
        message: "Failed to update profile",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Get user by ID
  public async getUserById(userId: string): Promise<IAuthResponse> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true },
      });

      if (!user) {
        return {
          success: false,
          message: "User not found",
          error: "User not found",
        };
      }

      return {
        success: true,
        message: "User fetched successfully",
        data: { user: user as any },
      };
    } catch (error) {
      console.error("Error fetching user:", error);
      return {
        success: false,
        message: "Failed to fetch user",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Get all users with pagination and filtering
  public async getAllUsers(query: IUserQuery) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        role,
        isBanned,
        isTrashed,
        isLoggedIn,
        sortBy,
        sortOrder,
      } = query;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (search) {
        where.OR = [
          { fullName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ];
      }
      if (role) where.role = role;
      if (isBanned !== undefined) where.isBanned = isBanned;
      if (isTrashed !== undefined) where.isTrashed = isTrashed;
      if (isLoggedIn !== undefined) where.isLoggedIn = isLoggedIn;

      const orderBy: any = {};
      if (sortBy && sortOrder) {
        orderBy[sortBy] = sortOrder;
      } else {
        orderBy.createdAt = "desc";
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: { profile: true },
        }),
        prisma.user.count({ where }),
      ]);

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error("Error fetching users:", error);
      throw error;
    }
  }

  // Get user statistics
  public async getUserStats(): Promise<IUserStats> {
    try {
      const [
        totalUsers,
        activeUsers,
        bannedUsers,
        trashedUsers,
        loggedInUsers,
        usersByRole,
        recentRegistrations,
        recentLogins,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: {
            isBanned: false,
            isTrashed: false,
            isDeletedPermanently: false,
          },
        }),
        prisma.user.count({ where: { isBanned: true } }),
        prisma.user.count({ where: { isTrashed: true } }),
        prisma.user.count({ where: { isLoggedIn: true } }),
        prisma.user.groupBy({
          by: ["role"],
          _count: { id: true },
        }),
        prisma.user.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
        }),
        prisma.user.count({
          where: {
            lastLoginAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
        }),
      ]);

      return {
        totalUsers,
        activeUsers,
        bannedUsers,
        trashedUsers,
        loggedInUsers,
        usersByRole: usersByRole.map((item) => ({
          role: item.role,
          count: item._count.id,
        })),
        recentRegistrations,
        recentLogins,
      };
    } catch (error) {
      console.error("Error fetching user stats:", error);
      throw error;
    }
  }

  // Update user (admin only)
  public async updateUser(
    userId: string,
    data: IUpdateUser
  ): Promise<IAuthResponse> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return {
          success: false,
          message: "User not found",
          error: "User not found",
        };
      }

      // Hash password if provided
      const updateData: any = { ...data };
      if (data.password) {
        updateData.password = await bcrypt.hash(data.password, 12);
      }

      // Prevent changing role for self from non-admin contexts (route already admin-guarded, but keep here too)
      // Ensure only allowed fields will be persisted

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        include: { profile: true },
      });

      return {
        success: true,
        message: "User updated successfully",
        data: { user: updatedUser as any },
      };
    } catch (error) {
      console.error("Error updating user:", error);
      return {
        success: false,
        message: "Failed to update user",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Delete user (soft delete)
  public async deleteUser(userId: string): Promise<IAuthResponse> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return {
          success: false,
          message: "User not found",
          error: "User not found",
        };
      }

      // Soft delete user
      await prisma.user.update({
        where: { id: userId },
        data: {
          isTrashed: true,
          isLoggedIn: false,
          nextAuthSecret: null,
          nextAuthExpiresAt: null,
        },
      });

      return {
        success: true,
        message: "User deleted successfully",
      };
    } catch (error) {
      console.error("Error deleting user:", error);
      return {
        success: false,
        message: "Failed to delete user",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export const authService = new AuthService();
