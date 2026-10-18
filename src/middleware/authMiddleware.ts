import { Request, Response, NextFunction } from "express";
import { authService } from "../module/auth/auth.service";

// Authentication middleware using NextAuth secret
export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    
    // Get NextAuth secret from header, Authorization bearer, or body
    let nextAuthSecret = req.headers['x-nextauth-secret'] as string || req.body?.nextAuthSecret;
    if (!nextAuthSecret) {
      const authHeader = req.headers['authorization'] as string | undefined;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        nextAuthSecret = authHeader.slice('Bearer '.length);
      }
    }
    
    if (!nextAuthSecret) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "NextAuth secret not provided"
      });
    }
    // Validate session
    const sessionValidation = await authService.validateSession(nextAuthSecret);
    
    if (!sessionValidation.isValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired session",
        error: sessionValidation.error
      });
    }
    // Add user to request object
    (req as any).user = sessionValidation.user;
    next();
    return;
  } catch (error) {
    console.error("❌ Error in authentication middleware:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication error",
      error: "Internal server error"
    });
  }
};

// Admin authorization middleware
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "User not authenticated"
      });
    }
    
    if (user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
        error: "Insufficient permissions"
      });
    }
    next();
    return;
  } catch (error) {
    console.error("❌ Error in admin authorization middleware:", error);
    return res.status(500).json({
      success: false,
      message: "Authorization error",
      error: "Internal server error"
    });
  }
};

// Optional authentication middleware (doesn't fail if no auth)
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let nextAuthSecret = req.headers['x-nextauth-secret'] as string || req.body?.nextAuthSecret;
    if (!nextAuthSecret) {
      const authHeader = req.headers['authorization'] as string | undefined;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        nextAuthSecret = authHeader.slice('Bearer '.length);
      }
    }
    
    if (nextAuthSecret) {
      const sessionValidation = await authService.validateSession(nextAuthSecret);
      if (sessionValidation.isValid) {
        (req as any).user = sessionValidation.user;
      }
    }

    next();
    return;
  } catch (error) {
    console.error("Error in optional authentication middleware:", error);
    // Don't fail the request, just continue without user
    next();
    return;
  }
};

// Check if user is banned or trashed
export const checkUserStatus = (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "User not authenticated"
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: "Account is banned",
        error: "Account access denied"
      });
    }

    if (user.isTrashed) {
      return res.status(403).json({
        success: false,
        message: "Account is deleted",
        error: "Account access denied"
      });
    }

    if (user.isDeletedPermanently) {
      return res.status(403).json({
        success: false,
        message: "Account is permanently deleted",
        error: "Account access denied"
      });
    }
    next();
    return;
  } catch (error) {
    console.error("❌ Error in user status middleware:", error);
    return res.status(500).json({
      success: false,
      message: "User status check error",
      error: "Internal server error"
    });
  }
};

// Combined authentication and status check
export const authenticateAndCheckStatus = [
  authenticateUser,
  checkUserStatus
];

// Combined admin authentication and status check
export const authenticateAdminAndCheckStatus = [
  authenticateUser,
  checkUserStatus,
  requireAdmin
];


