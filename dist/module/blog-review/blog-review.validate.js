"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUpdateBlogReview = exports.validateBlogReviewReplyId = exports.validateBlogIdParam = exports.validateBlogReviewId = exports.validateBlogReviewQuery = exports.validateCreateBlogReviewReply = exports.validateCreateBlogReview = void 0;
const blog_review_type_1 = require("./blog-review.type");
const validateCreateBlogReview = (req, res, next) => {
    try {
        const validatedData = blog_review_type_1.createBlogReviewSchema.parse(req.body);
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
exports.validateCreateBlogReview = validateCreateBlogReview;
const validateCreateBlogReviewReply = (req, res, next) => {
    try {
        const validatedData = blog_review_type_1.createBlogReviewReplySchema.parse(req.body);
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
exports.validateCreateBlogReviewReply = validateCreateBlogReviewReply;
const validateBlogReviewQuery = (req, res, next) => {
    try {
        const validatedData = blog_review_type_1.blogReviewQuerySchema.parse(req.query);
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
exports.validateBlogReviewQuery = validateBlogReviewQuery;
const validateBlogReviewId = (req, res, next) => {
    try {
        const validatedData = blog_review_type_1.blogReviewIdSchema.parse(req.params);
        req.params = validatedData;
        next();
        return;
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: "Invalid review ID",
            error: error.errors || error.message,
        });
    }
};
exports.validateBlogReviewId = validateBlogReviewId;
const validateBlogIdParam = (req, res, next) => {
    try {
        const validatedData = blog_review_type_1.blogIdParamSchema.parse(req.params);
        req.params = validatedData;
        next();
        return;
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: "Invalid blog ID",
            error: error.errors || error.message,
        });
    }
};
exports.validateBlogIdParam = validateBlogIdParam;
const validateBlogReviewReplyId = (req, res, next) => {
    try {
        const validatedData = blog_review_type_1.blogReviewReplyIdSchema.parse(req.params);
        req.params = validatedData;
        next();
        return;
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: "Invalid reply ID",
            error: error.errors || error.message,
        });
    }
};
exports.validateBlogReviewReplyId = validateBlogReviewReplyId;
const validateUpdateBlogReview = (req, res, next) => {
    try {
        const validatedData = blog_review_type_1.updateBlogReviewSchema.parse(req.body);
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
exports.validateUpdateBlogReview = validateUpdateBlogReview;
//# sourceMappingURL=blog-review.validate.js.map