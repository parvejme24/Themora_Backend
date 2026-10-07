"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboard_controller_1 = require("./dashboard.controller");
const authMiddleware_1 = require("../../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.get("/dashboard/overview", authMiddleware_1.authenticateAdminAndCheckStatus, dashboard_controller_1.getDashboardOverview);
router.get("/dashboard/stats", authMiddleware_1.authenticateAdminAndCheckStatus, dashboard_controller_1.getDashboardOverview);
exports.default = router;
//# sourceMappingURL=dashboard.route.js.map