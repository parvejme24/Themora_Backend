"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const contact_controller_1 = require("./contact.controller");
const contact_validate_1 = require("./contact.validate");
const authMiddleware_1 = require("../../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.post("/contacts", authMiddleware_1.optionalAuth, contact_validate_1.validateCreateContact, contact_controller_1.addNewContact);
router.get("/contacts", authMiddleware_1.authenticateAdminAndCheckStatus, contact_validate_1.validateContactQuery, contact_controller_1.getAllContacts);
router.post("/contacts/:id/reply", authMiddleware_1.authenticateAdminAndCheckStatus, contact_validate_1.validateContactParams, contact_validate_1.validateCreateContactReply, contact_controller_1.sendContactReply);
router.get("/contacts/stats", authMiddleware_1.authenticateAdminAndCheckStatus, contact_controller_1.getContactStats);
router.get("/contacts/email/:userEmail", authMiddleware_1.authenticateAndCheckStatus, contact_validate_1.validateUserEmailParams, contact_controller_1.getContactsByUserEmail);
router.get("/contacts/:id", authMiddleware_1.optionalAuth, contact_validate_1.validateContactParams, contact_controller_1.getContactById);
router.delete("/contacts/:id", authMiddleware_1.authenticateAdminAndCheckStatus, contact_validate_1.validateContactParams, contact_controller_1.deleteContact);
exports.default = router;
//# sourceMappingURL=contact.route.js.map