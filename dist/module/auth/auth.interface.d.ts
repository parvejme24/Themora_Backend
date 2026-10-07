import { User, UserProfile } from "@prisma/client";
export interface IUser extends User {
    profile?: UserProfile;
}
export interface IRegisterUser {
    fullName?: string;
    name?: string;
    email: string;
    password: string;
    clientToken?: string;
}
export interface ILoginUser {
    email: string;
    password: string;
    clientToken?: string;
}
export interface IGoogleLogin {
    email: string;
    fullName: string;
    providerId: string;
    avatarUrl?: string;
    clientToken?: string;
}
export interface INextAuthSession {
    nextAuthSecret: string;
    nextAuthExpiresAt: Date;
    isLoggedIn: boolean;
    lastLoginAt: Date;
    provider: string;
    providerId?: string;
}
export interface IUpdateUser {
    fullName?: string;
    email?: string;
    password?: string;
    role?: 'ADMIN' | 'USER';
    isBanned?: boolean;
    isTrashed?: boolean;
    isDeletedPermanently?: boolean;
}
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
export interface ISessionValidation {
    isValid: boolean;
    user?: IUser;
    error?: string;
}
export interface IChangePassword {
    currentPassword: string;
    newPassword: string;
}
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
export interface IUpdateProfile {
    avatarUrl?: string;
    designation?: string;
    fullName?: string;
    name?: string;
    phone?: string;
    address?: string;
    country?: string;
    city?: string;
    stateOrRegion?: string;
    postCode?: string;
}
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
export interface IUserStats {
    totalUsers: number;
    activeUsers: number;
    bannedUsers: number;
    trashedUsers: number;
    loggedInUsers: number;
    usersByRole: {
        role: string;
        count: number;
    }[];
    recentRegistrations: number;
    recentLogins: number;
}
//# sourceMappingURL=auth.interface.d.ts.map