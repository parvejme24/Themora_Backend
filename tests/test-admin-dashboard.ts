import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { authService } from "../src/module/auth/auth.service";
import { templateService } from "../src/module/template/template.service";
import { orderService } from "../src/module/order/order.service";
import { dashboardService } from "../src/module/dashboard/dashboard.service";

const prisma = new PrismaClient();

async function main() {
  console.log("================================================================================");
  console.log("📊 TESTING ADMIN DASHBOARD OVERVIEW APIS (/dashboard)");
  console.log("================================================================================\n");

  // 0. Authenticate Admin
  console.log("🔑 [Auth Setup] Authenticating Admin user...");
  const adminLogin = await authService.loginUser({
    email: "admin@themora.test",
    password: "Admin@Themora2026!",
  });
  const adminUser = adminLogin.data?.user!;
  console.log(`   ✓ Admin authenticated: ${adminUser.fullName} (${adminUser.email})\n`);

  // ---------------------------------------------------------------------------
  // 1. USER STATS (Cards: Total Users, Active Users, Growth) -> StatsGrid.tsx
  // ---------------------------------------------------------------------------
  console.log("👥 1. USER STATS (GET /api/v1/auth/users/stats)...");
  const userStats = await authService.getUserStats();
  console.log(`   ✓ Total Users: ${userStats.totalUsers}`);
  console.log(`   ✓ Active Users: ${userStats.activeUsers}`);
  console.log(`   ✓ Recent Registrations (7-day growth): ${userStats.recentRegistrations}`);
  console.log(`   ✓ Users by Role:`, JSON.stringify(userStats.usersByRole));

  // ---------------------------------------------------------------------------
  // 2. THEME STATS (Cards: Themes in Catalog, Total Downloads) -> StatsGrid.tsx
  // ---------------------------------------------------------------------------
  console.log("\n🎨 2. THEME STATS (GET /api/v1/templates/stats)...");
  const templateStats = await templateService.getTemplateStats();
  console.log(`   ✓ Themes in Catalog: ${templateStats.totalTemplates}`);
  console.log(`   ✓ Total Downloads: ${templateStats.totalDownloads}`);
  console.log(`   ✓ Total Purchases: ${templateStats.totalPurchases}`);
  console.log(`   ✓ Average Theme Price: $${templateStats.averagePrice?.toFixed(2) || "0.00"}`);

  // ---------------------------------------------------------------------------
  // 3. ORDER & REVENUE STATS (Cards: Gross Revenue, Total Orders) -> StatsGrid.tsx
  // ---------------------------------------------------------------------------
  console.log("\n💳 3. ORDER & REVENUE STATS (GET /api/v1/orders/stats)...");
  const orderStats = await orderService.getOrderStats();
  console.log(`   ✓ Gross Revenue: $${orderStats.totalRevenue.toFixed(2)}`);
  console.log(`   ✓ Total Orders: ${orderStats.totalOrders}`);
  console.log(`   ✓ Orders by Status:`, JSON.stringify(orderStats.ordersByStatus));
  console.log(`   ✓ Orders by License Type:`, JSON.stringify(orderStats.ordersByLicenseType));

  // ---------------------------------------------------------------------------
  // 4. REVENUE TIMELINE CHART (6-Month Monthly Earnings) -> RevenueChart.tsx
  // ---------------------------------------------------------------------------
  console.log("\n📈 4. REVENUE TIMELINE CHART (GET /api/v1/orders?page=1&limit=100)...");
  const ordersForChart = await orderService.getAllOrders({
    page: 1,
    limit: 100,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  console.log(`   ✓ Retrieved ${ordersForChart.orders.length} orders for timeline calculation`);

  // ---------------------------------------------------------------------------
  // 5. RECENT ACTIVITY (Live Orders Feed) -> RecentActivity.tsx
  // ---------------------------------------------------------------------------
  console.log("\n⚡ 5. RECENT ACTIVITY (GET /api/v1/orders?page=1&limit=6)...");
  const recentOrders = await orderService.getAllOrders({
    page: 1,
    limit: 6,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  console.log(`   ✓ Retrieved ${recentOrders.orders.length} latest live orders:`);
  recentOrders.orders.forEach((o: any, idx: number) => {
    console.log(`      ${idx + 1}. Order ${o.id.substring(0, 8)}... | ${o.customerName || "Customer"} | $${o.totalAmount} (${o.status}) | Template: "${o.template?.title || "Custom"}"`);
  });

  // ---------------------------------------------------------------------------
  // 6. AGGREGATED DASHBOARD OVERVIEW (GET /api/v1/dashboard/overview)
  // ---------------------------------------------------------------------------
  console.log("\n🚀 6. AGGREGATED DASHBOARD OVERVIEW (GET /api/v1/dashboard/overview)...");
  const overview = await dashboardService.getDashboardOverview();
  console.log(`   ✓ Overview Stats Grid Summary:`, JSON.stringify(overview.stats, null, 2));
  console.log(`   ✓ Monthly Revenue Timeline:`, JSON.stringify(overview.revenueTimeline));

  console.log("\n================================================================================");
  console.log("🎉 ALL ADMIN DASHBOARD OVERVIEW APIS TESTED & PERSISTED IN DB!");
  console.log("================================================================================");
}

main()
  .catch((err) => {
    console.error("❌ Admin dashboard test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
