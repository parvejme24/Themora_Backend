import { Request, Response, NextFunction } from "express";
export declare const validateRegisterUser: (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const validateLoginUser: (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const validateGoogleLogin: (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const validateChangePassword: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const validateUpdateProfile: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const validateUserQuery: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const validateUserId: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const validateSessionValidation: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const validateLogout: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const validateVerifyOtp: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const validateResendOtp: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const validateRequestPasswordReset: (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const validatePasswordResetOtp: (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const validateResetPasswordWithOtp: (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
//# sourceMappingURL=auth.validate.d.ts.map