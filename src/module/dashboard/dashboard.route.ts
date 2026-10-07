import { Router } from "express";
import { getDashboardOverview } from "./dashboard.controller";
import { authenticateAdminAndCheckStatus } from "../../middleware/authMiddleware";

const router = Router();

// Admin Dashboard Overview Route
router.get("/dashboard/overview", authenticateAdminAndCheckStatus, getDashboardOverview);
router.get("/dashboard/stats", authenticateAdminAndCheckStatus, getDashboardOverview);

export default router;
