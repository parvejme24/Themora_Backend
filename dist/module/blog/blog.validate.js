"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBlogReaction = exports.validateBlogStatus = exports.validateBlogLike = exports.validateAuthorId = exports.validateCategoryId = exports.validateBlogId = exports.validateBlogQuery = exports.validateUpdateBlog = exports.validateCreateBlog = void 0;
const blog_type_1 = require("./blog.type");
const validateCreateBlog = (req, res, next) => {
    try {
        const validatedData = blog_type_1.createBlogSchema.parse(req.body);
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
exports.validateCreateBlog = validateCreateBlog;
const validateUpdateBlog = (req, res, next) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            req.body = {};
            next();
            return;
        }
        const validatedData = blog_type_1.updateBlogSchema.parse(req.body);
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
exports.validateUpdateBlog = validateUpdateBlog;
const validateBlogQuery = (req, res, next) => {
    try {
        const validatedData = blog_type_1.blogQuerySchema.parse(req.query);
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
exports.validateBlogQuery = validateBlogQuery;
const validateBlogId = (req, res, next) => {
    try {
        const validatedData = blog_type_1.blogIdSchema.parse(req.params);
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
exports.validateBlogId = validateBlogId;
const validateCategoryId = (req, res, next) => {
    try {
        const validatedData = blog_type_1.categoryIdSchema.parse(req.params);
        req.params = validatedData;
        next();
        return;
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: "Invalid category ID",
            error: error.errors || error.message,
        });
    }
};
exports.validateCategoryId = validateCategoryId;
const validateAuthorId = (req, res, next) => {
    try {
        const validatedData = blog_type_1.authorIdSchema.parse(req.params);
        req.params = validatedData;
        next();
        return;
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: "Invalid author ID",
            error: error.errors || error.message,
        });
    }
};
exports.validateAuthorId = validateAuthorId;
const validateBlogLike = (req, res, next) => {
    try {
        const validatedData = blog_type_1.blogLikeSchema.parse(req.body);
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
exports.validateBlogLike = validateBlogLike;
const validateBlogStatus = (req, res, next) => {
    try {
        const validatedData = blog_type_1.blogStatusSchema.parse(req.body);
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
exports.validateBlogStatus = validateBlogStatus;
const validateBlogReaction = (req, res, next) => {
    try {
        const validatedData = blog_type_1.blogReactionSchema.parse(req.body);
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
exports.validateBlogReaction = validateBlogReaction;
//# sourceMappingURL=blog.validate.js.map