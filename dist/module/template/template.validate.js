"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateNewArrivalsQuery = exports.validateTemplateQuery = exports.validateTemplateId = exports.validateUpdateTemplate = exports.validateCreateTemplate = void 0;
const template_type_1 = require("./template.type");
const validateCreateTemplate = (req, res, next) => {
    try {
        const validatedData = template_type_1.createTemplateSchema.parse(req.body);
        req.validatedData = validatedData;
        return next();
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: "Validation error",
            errors: error.errors || error.message,
        });
    }
};
exports.validateCreateTemplate = validateCreateTemplate;
const validateUpdateTemplate = (req, res, next) => {
    try {
        const validatedData = template_type_1.updateTemplateSchema.parse(req.body);
        req.validatedData = validatedData;
        return next();
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: "Validation error",
            errors: error.errors || error.message,
        });
    }
};
exports.validateUpdateTemplate = validateUpdateTemplate;
const validateTemplateId = (req, res, next) => {
    try {
        const validatedParams = template_type_1.templateIdSchema.parse(req.params);
        req.validatedParams = validatedParams;
        return next();
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: "Invalid template ID",
            errors: error.errors || error.message,
        });
    }
};
exports.validateTemplateId = validateTemplateId;
const validateTemplateQuery = (req, res, next) => {
    try {
        const validatedQuery = template_type_1.templateQuerySchema.parse(req.query);
        req.validatedQuery = validatedQuery;
        return next();
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: "Invalid query parameters",
            errors: error.errors || error.message,
        });
    }
};
exports.validateTemplateQuery = validateTemplateQuery;
const validateNewArrivalsQuery = (req, res, next) => {
    try {
        const validatedQuery = template_type_1.newArrivalsQuerySchema.parse(req.query);
        req.validatedQuery = validatedQuery;
        return next();
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: "Invalid query parameters",
            errors: error.errors || error.message,
        });
    }
};
exports.validateNewArrivalsQuery = validateNewArrivalsQuery;
//# sourceMappingURL=template.validate.js.map