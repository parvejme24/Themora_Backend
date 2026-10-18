import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { authService } from "../src/module/auth/auth.service";
import { contactService } from "../src/module/contact/contact.service";
import { dashboardService } from "../src/module/dashboard/dashboard.service";

const prisma = new PrismaClient();

async function main() {
  console.log("================================================================================");
  console.log("🛠️ TESTING SERVICE REQUESTS & UNIFIED ADMIN DASHBOARD APIS");
  console.log("================================================================================\n");

  // 0. Authenticate Users
  console.log("🔑 [Auth Setup] Authenticating test accounts...");
  const adminLogin = await authService.loginUser({
    email: "admin@themora.test",
    password: "Admin@Themora2026!",
  });
  const userLogin = await authService.loginUser({
    email: "sarah.user@themora.test",
    password: "User@Themora2026!",
  });

  const adminUser = adminLogin.data?.user!;
  const standardUser = userLogin.data?.user!;
  console.log(`   ✓ Admin ready: ${adminUser.fullName} (${adminUser.email})`);
  console.log(`   ✓ User ready: ${standardUser.fullName} (${standardUser.email})`);

  // ---------------------------------------------------------------------------
  // 1. SUBMIT PROJECT BRIEF / SERVICE REQUEST (PUBLIC / USER)
  // ---------------------------------------------------------------------------
  console.log("\n📝 1. SUBMIT PROJECT BRIEF / SERVICE REQUEST (POST /api/v1/contacts)...");
  const projectBrief = await contactService.createContact({
    fullName: standardUser.fullName,
    email: standardUser.email,
    companyName: "FinScale Dynamics",
    serviceRequired: "Enterprise SaaS & Crypto Landing Page Development",
    budget: "$8,000 - $15,000",
    projectDetails: "We require a bespoke Next.js 15 Tailwind web platform with custom 3D Canvas animations, Stripe billing, and sub-account management.",
    userId: standardUser.id,
  });
  console.log(`   ✓ Created Service Request: ID ${projectBrief.id}`);
  console.log(`      - Client: ${projectBrief.fullName} (${projectBrief.email})`);
  console.log(`      - Service: ${projectBrief.serviceRequired} | Budget: ${projectBrief.budget}`);

  // ---------------------------------------------------------------------------
  // 2. GET USER'S SERVICE REQUESTS (PROTECTED USER)
  // ---------------------------------------------------------------------------
  console.log("\n📂 2. GET USER'S SERVICE REQUESTS (GET /api/v1/contacts/email/:userEmail?page=1&limit=10)...");
  const userRequests = await contactService.getContactsByUserEmail(standardUser.email, 1, 10);
  console.log(`   ✓ Retrieved ${userRequests.pagination.total} inquiries for ${standardUser.email} (Page ${userRequests.pagination.page}/${userRequests.pagination.totalPages}):`);
  userRequests.contacts.forEach((c, idx) => {
    console.log(`      ${idx + 1}. [${c.serviceRequired}] Budget: ${c.budget} (Replies: ${c.replies?.length || 0})`);
  });

  // ---------------------------------------------------------------------------
  // 3. GET ALL SERVICE REQUESTS (ADMIN)
  // ---------------------------------------------------------------------------
  console.log("\n📋 3. GET ALL SERVICE REQUESTS (GET /api/v1/contacts?page=1&limit=10)...");
  const allRequests = await contactService.getAllContacts({
    page: 1,
    limit: 10,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  console.log(`   ✓ Admin retrieved ${allRequests.pagination.total} total platform client inquiries`);

  // ---------------------------------------------------------------------------
  // 4. SEND OFFICIAL QUOTE / REPLY (ADMIN)
  // ---------------------------------------------------------------------------
  console.log("\n💬 4. SEND OFFICIAL QUOTE / REPLY (POST /api/v1/contacts/:id/reply)...");
  const quoteReply = await contactService.createContactReply({
    contactId: projectBrief.id,
    userId: adminUser.id,
    subject: "Official Proposal & Quote: Enterprise SaaS Web Platform",
    message: "Hi Sarah,\n\nWe have reviewed your project brief. We can deliver the full Next.js 15 platform with 3D canvas animations and Stripe billing within 4 weeks for $9,500. Let us know if you'd like to schedule the kickoff sprint!\n\nBest,\nThemora Solutions Team",
  });
  console.log(`   ✓ Admin quote sent: "${quoteReply.subject}" to ${projectBrief.email} (Reply ID: ${quoteReply.id})`);

  // ---------------------------------------------------------------------------
  // 5. SERVICE REQUEST STATS (ADMIN)
  // ---------------------------------------------------------------------------
  console.log("\n📊 5. SERVICE REQUEST STATS (GET /api/v1/contacts/stats)...");
  const contactStats = await contactService.getContactStats();
  console.log(`   ✓ Total Client Inquiries: ${contactStats.totalContacts}`);
  console.log(`   ✓ Total Official Replies: ${contactStats.totalReplies}`);
  console.log(`   ✓ Inquiries Status Breakdown:`, JSON.stringify(contactStats.statusCounts, null, 2));

  // ---------------------------------------------------------------------------
  // 6. UNIFIED ADMIN DASHBOARD OVERVIEW API
  // ---------------------------------------------------------------------------
  console.log("\n🚀 6. UNIFIED ADMIN DASHBOARD OVERVIEW API (GET /api/v1/dashboard/overview)...");
  const unifiedDashboard = await dashboardService.getDashboardOverview();
  console.log(`   ✓ Summary Cards Feed:`, JSON.stringify(unifiedDashboard.stats, null, 2));
  console.log(`   ✓ 6-Month Monthly Earnings Timeline:`, JSON.stringify(unifiedDashboard.revenueTimeline));
  console.log(`   ✓ Live Recent Orders Feed: ${unifiedDashboard.recentOrders.length} orders`);

  console.log("\n================================================================================");
  console.log("🎉 ALL SERVICE REQUESTS & UNIFIED DASHBOARD APIS TESTED & PERSISTED IN DB!");
  console.log("================================================================================");
}

main()
  .catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
