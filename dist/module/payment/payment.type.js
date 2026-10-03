"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCheckoutSchema = void 0;
const zod_1 = require("zod");
exports.createCheckoutSchema = zod_1.z.object({
    productType: zod_1.z.enum(["template", "plan"]),
    productId: zod_1.z.string().uuid(),
    customerEmail: zod_1.z.string().email().optional(),
    customerName: zod_1.z.string().trim().min(2).max(120).optional(),
});
//# sourceMappingURL=payment.type.js.map