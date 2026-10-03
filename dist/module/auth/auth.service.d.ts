import { IRegisterUser, ILoginUser, IGoogleLogin, IUpdateUser, IAuthResponse, ISessionValidation, IChangePassword, IUpdateProfile, IUserQuery, IUserStats, IVerifyOtp, IResendOtp, IResetPasswordWithOtp } from "./auth.interface";
declare class AuthService {
    private generateNextAuthSecret;
    private generateSessionExpiration;
    registerUser(data: IRegisterUser): Promise<IAuthResponse>;
    loginUser(data: ILoginUser): Promise<IAuthResponse>;
    googleLogin(data: IGoogleLogin): Promise<IAuthResponse>;
    validateSession(nextAuthSecret: string): Promise<ISessionValidation>;
    logoutUser(nextAuthSecret: string): Promise<IAuthResponse>;
    verifyOtp(data: IVerifyOtp): Promise<IAuthResponse>;
    resendOtp(data: IResendOtp): Promise<IAuthResponse>;
    requestPasswordReset(email: string): Promise<IAuthResponse>;
    verifyPasswordResetOtp(data: IVerifyOtp): Promise<IAuthResponse>;
    resetPasswordWithOtp(data: IResetPasswordWithOtp): Promise<IAuthResponse>;
    changePassword(userId: string, data: IChangePassword): Promise<IAuthResponse>;
    updateProfile(userId: string, data: IUpdateProfile): Promise<IAuthResponse>;
    getUserById(userId: string): Promise<IAuthResponse>;
    getAllUsers(query: IUserQuery): Promise<{
        users: ({
            profile: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                avatarUrl: string | null;
                coverImageUrl: string | null;
                designation: string | null;
                phone: string | null;
                country: string | null;
                city: string | null;
                stateOrRegion: string | null;
                postCode: string | null;
                balance: number;
            } | null;
        } & {
            id: string;
            fullName: string;
            email: string;
            password: string | null;
            role: import(".prisma/client").$Enums.UserRole;
            isBanned: boolean;
            isTrashed: boolean;
            isDeletedPermanently: boolean;
            otpCode: string | null;
            otpPurpose: import(".prisma/client").$Enums.OtpPurpose | null;
            otpExpiresAt: Date | null;
            otpVerified: boolean;
            createdAt: Date;
            updatedAt: Date;
            isLoggedIn: boolean;
            lastLoginAt: Date | null;
            nextAuthExpiresAt: Date | null;
            nextAuthSecret: string | null;
            provider: string | null;
            providerId: string | null;
        })[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    getUserStats(): Promise<IUserStats>;
    updateUser(userId: string, data: IUpdateUser): Promise<IAuthResponse>;
    deleteUser(userId: string): Promise<IAuthResponse>;
}
export declare const authService: AuthService;
export {};
//# sourceMappingURL=auth.service.d.ts.map