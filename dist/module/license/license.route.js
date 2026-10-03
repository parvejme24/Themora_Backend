"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const license_controller_1 = require("./license.controller");
const authMiddleware_1 = require("../../middleware/authMiddleware");
const license_validate_1 = require("./license.validate");
const router = (0, express_1.Router)();
router.get('/licenses', authMiddleware_1.authenticateAdminAndCheckStatus, license_validate_1.validateLicenseQuery, license_controller_1.getAllLicenses);
router.get('/licenses/stats', authMiddleware_1.authenticateAdminAndCheckStatus, license_controller_1.getLicenseStats);
router.get('/licenses/:id', authMiddleware_1.authenticateAdminAndCheckStatus, license_validate_1.validateLicenseId, license_controller_1.getLicenseById);
router.post('/licenses/validate', license_validate_1.validateLicenseKey, license_controller_1.validateLicense);
router.get('/user/licenses', authMiddleware_1.authenticateAndCheckStatus, license_validate_1.validateLicenseQuery, license_controller_1.getUserLicenses);
router.patch('/licenses/:id/revoke', authMiddleware_1.authenticateAdminAndCheckStatus, license_validate_1.validateLicenseId, license_validate_1.validateRevokeLicense, license_controller_1.revokeLicense);
exports.default = router;
//# sourceMappingURL=license.route.js.map