"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCreateCheckout = void 0;
const zod_1 = require("zod");
const payment_type_1 = require("./payment.type");
const validateCreateCheckout = (req, res, next) => {
    const result = zod_1.z.object({ body: payment_type_1.createCheckoutSchema }).safeParse(req);
    if (!result.success) {
        res.status(400).json({ success: false, message: "Invalid checkout details", errors: result.error.issues });
        return;
    }
    req.validatedBody = result.data.body;
    next();
};
exports.validateCreateCheckout = validateCreateCheckout;
//# sourceMappingURL=payment.validate.js.map