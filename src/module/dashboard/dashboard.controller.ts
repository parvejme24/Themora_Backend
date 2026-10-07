import { Request, Response } from "express";
import { dashboardService } from "./dashboard.service";

export const getDashboardOverview = async (req: Request, res: Response) => {
  try {
    const data = await dashboardService.getDashboardOverview();
    return res.status(200).json({
      success: true,
      message: "Dashboard overview metrics fetched successfully",
      data,
    });
  } catch (error: any) {
    console.error("Error fetching dashboard overview:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard overview metrics",
      error: error.message || "Unknown error",
    });
  }
};
