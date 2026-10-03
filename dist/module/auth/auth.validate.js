"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateResetPasswordWithOtp = exports.validatePasswordResetOtp = exports.validateRequestPasswordReset = exports.validateResendOtp = exports.validateVerifyOtp = exports.validateLogout = exports.validateSessionValidation = exports.validateUserId = exports.validateUserQuery = exports.validateUpdateProfile = exports.validateChangePassword = exports.validateGoogleLogin = exports.validateLoginUser = exports.validateRegisterUser = void 0;
const auth_type_1 = require("./auth.type");
const validateRegisterUser = (req, res, next) => {
    try {
        const validatedData = auth_type_1.registerUserSchema.parse(req.body);
        req.body = validatedData;
        return next();
        return;
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            error: error.errors || error.message,
        });
    }
};
exports.validateRegisterUser = validateRegisterUser;
const validateLoginUser = (req, res, next) => {
    try {
        const validatedData = auth_type_1.loginUserSchema.parse(req.body);
        req.body = validatedData;
        return next();
        return;
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            error: error.errors || error.message,
        });
    }
};
exports.validateLoginUser = validateLoginUser;
const validateGoogleLogin = (req, res, next) => {
    try {
        const validatedData = auth_type_1.googleLoginSchema.parse(req.body);
        req.body = validatedData;
        return next();
        return;
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            error: error.errors || error.message,
        });
    }
};
exports.validateGoogleLogin = validateGoogleLogin;
const validateChangePassword = (req, res, next) => {
    try {
        const validatedData = auth_type_1.changePasswordSchema.parse(req.body);
        req.body = validatedData;
        next();
        return;
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            error: error.errors || error.message,
        });
    }
};
exports.validateChangePassword = validateChangePassword;
const validateUpdateProfile = (req, res, next) => {
    try {
        const validatedData = auth_type_1.updateProfileSchema.parse(req.body);
        req.body = validatedData;
        next();
        return;
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            error: error.errors || error.message,
        });
    }
};
exports.validateUpdateProfile = validateUpdateProfile;
const validateUserQuery = (req, res, next) => {
    try {
        const validatedData = auth_type_1.userQuerySchema.parse(req.query);
        req.validatedQuery = validatedData;
        next();
        return;
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: "Invalid query parameters",
            error: error.errors || error.message,
        });
    }
};
exports.validateUserQuery = validateUserQuery;
const validateUserId = (req, res, next) => {
    try {
        const validatedData = auth_type_1.userIdSchema.parse(req.params);
        req.params = validatedData;
        next();
        return;
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: "Invalid user ID",
            error: error.errors || error.message,
        });
    }
};
exports.validateUserId = validateUserId;
const validateSessionValidation = (req, res, next) => {
    try {
        const validatedData = auth_type_1.sessionValidationSchema.parse(req.body);
        req.body = validatedData;
        next();
        return;
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            error: error.errors || error.message,
        });
    }
};
exports.validateSessionValidation = validateSessionValidation;
const validateLogout = (req, res, next) => {
    try {
        const validatedData = auth_type_1.logoutSchema.parse(req.body);
        req.body = validatedData;
        next();
        return;
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            error: error.errors || error.message,
        });
    }
};
exports.validateLogout = validateLogout;
const validateVerifyOtp = (req, res, next) => {
    try {
        const validatedData = auth_type_1.verifyOtpSchema.parse(req.body);
        req.body = validatedData;
        next();
        return;
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            error: error.errors || error.message,
        });
    }
};
exports.validateVerifyOtp = validateVerifyOtp;
const validateResendOtp = (req, res, next) => {
    try {
        const validatedData = auth_type_1.resendOtpSchema.parse(req.body);
        req.body = validatedData;
        next();
        return;
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            error: error.errors || error.message,
        });
    }
};
exports.validateResendOtp = validateResendOtp;
const validateRequestPasswordReset = (req, res, next) => {
    try {
        req.body = auth_type_1.requestPasswordResetSchema.parse(req.body);
        return next();
    }
    catch (error) {
        return res.status(400).json({ success: false, message: "Invalid email address", error: error.errors || error.message });
    }
};
exports.validateRequestPasswordReset = validateRequestPasswordReset;
const validatePasswordResetOtp = (req, res, next) => {
    try {
        req.body = auth_type_1.verifyPasswordResetOtpSchema.parse(req.body);
        return next();
    }
    catch (error) {
        return res.status(400).json({ success: false, message: "Invalid reset code details", error: error.errors || error.message });
    }
};
exports.validatePasswordResetOtp = validatePasswordResetOtp;
const validateResetPasswordWithOtp = (req, res, next) => {
    try {
        req.body = auth_type_1.resetPasswordWithOtpSchema.parse(req.body);
        return next();
    }
    catch (error) {
        return res.status(400).json({ success: false, message: "Invalid password reset details", error: error.errors || error.message });
    }
};
exports.validateResetPasswordWithOtp = validateResetPasswordWithOtp;
//# sourceMappingURL=auth.validate.js.map