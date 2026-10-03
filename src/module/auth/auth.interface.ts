import { User, UserProfile } from "@prisma/client";

// Base User interface
export interface IUser extends User {
  profile?: UserProfile;
}

// User registration interface
export interface IRegisterUser {
  fullName: string;
  email: string;
  password: string;
  clientToken?: string; // Frontend-provided session token to store as nextAuthSecret
}

// User login interface
export interface ILoginUser {
  email: string;
  password: string;
  clientToken?: string; // Frontend-provided session token to store as nextAuthSecret
}

// Google OAuth login interface
export interface IGoogleLogin {
  email: string;
  fullName: string;
  providerId: string;
  avatarUrl?: string;
  clientToken?: string; // Frontend-provided session token to store as nextAuthSecret
}

// NextAuth session interface
export interface INextAuthSession {
  nextAuthSecret: string;
  nextAuthExpiresAt: Date;
  isLoggedIn: boolean;
  lastLoginAt: Date;
  provider: string;
  providerId?: string;
}

// User update interface
export interface IUpdateUser {
  fullName?: string;
  email?: string;
  password?: string;
  role?: 'ADMIN' | 'USER';
  isBanned?: boolean;
  isTrashed?: boolean;
  isDeletedPermanently?: boolean;
}

// Auth response interface
export interface IAuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: IUser;
    nextAuthSecret?: string;
    expiresAt?: Date;
  };
  error?: string;
}

// Session validation interface
export interface ISessionValidation {
  isValid: boolean;
  user?: IUser;
  error?: string;
}

// Password change interface
export interface IChangePassword {
  currentPassword: string;
  newPassword: string;
}

// OTP verification interfaces
export interface IVerifyOtp {
  email: string;
  otp: string;
}

export interface IResendOtp {
  email: string;
}

export interface IResetPasswordWithOtp extends IVerifyOtp {
  newPassword: string;
}

// User profile update interface
export interface IUpdateProfile {
  avatarUrl?: string;
  designation?: string;
  fullName?: string;
  phone?: string;
  country?: string;
  city?: string;
  stateOrRegion?: string;
  postCode?: string;
}

// User query interface
export interface IUserQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: 'ADMIN' | 'USER';
  isBanned?: boolean;
  isTrashed?: boolean;
  isLoggedIn?: boolean;
  sortBy?: 'createdAt' | 'updatedAt' | 'lastLoginAt' | 'fullName' | 'email';
  sortOrder?: 'asc' | 'desc';
}

// User stats interface
export interface IUserStats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  trashedUsers: number;
  loggedInUsers: number;
  usersByRole: { role: string; count: number }[];
  recentRegistrations: number;
  recentLogins: number;
}
