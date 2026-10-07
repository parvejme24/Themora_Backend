"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardOverview = void 0;
const dashboard_service_1 = require("./dashboard.service");
const getDashboardOverview = async (req, res) => {
    try {
        const data = await dashboard_service_1.dashboardService.getDashboardOverview();
        return res.status(200).json({
            success: true,
            message: "Dashboard overview metrics fetched successfully",
            data,
        });
    }
    catch (error) {
        console.error("Error fetching dashboard overview:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard overview metrics",
            error: error.message || "Unknown error",
        });
    }
};
exports.getDashboardOverview = getDashboardOverview;
//# sourceMappingURL=dashboard.controller.js.map