import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { TemplateCategoryService } from "../src/module/template-category/template-category.service";
import { authService } from "../src/module/auth/auth.service";

const prisma = new PrismaClient();
const categoryService = new TemplateCategoryService();

async function testThemeCategoryApis() {
  console.log("==================================================");
  console.log("🚀 TESTING THEME CATEGORY APIS & DATABASE STORAGE");
  console.log("==================================================");

  // 0. Ensure an Admin user exists for authentication
  console.log("\n🔑 0. Authenticating Admin User...");
  const adminLogin = await authService.loginUser({
    email: "admin@themora.test",
    password: "Admin@Themora2026!",
  });
  if (!adminLogin.success || !adminLogin.data?.nextAuthSecret) {
    throw new Error("Failed to authenticate admin user for testing");
  }
  const adminToken = adminLogin.data.nextAuthSecret;
  console.log("✅ Admin Authenticated. Token:", adminToken.substring(0, 16) + "...");

  // Clean up previous test category if exists
  const testCategoryTitle = "Fintech & Banking SaaS";
  const existingTestCat = await prisma.templateCategory.findFirst({
    where: { title: testCategoryTitle },
  });
  if (existingTestCat) {
    // Delete any templates attached before deleting category
    await prisma.template.deleteMany({ where: { categoryId: existingTestCat.id } });
    await prisma.templateCategory.delete({ where: { id: existingTestCat.id } });
  }

  // 1. CREATE THEME CATEGORY (POST /api/v1/template-categories)
  console.log("\n📦 1. Testing CREATE THEME CATEGORY (POST /api/v1/template-categories)...");
  const createdCategory = await categoryService.createTemplateCategory({
    title: testCategoryTitle,
    image: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80",
  });
  console.log("✅ Category Created in DB:", {
    id: createdCategory.id,
    title: createdCategory.title,
    slug: createdCategory.slug,
    image: createdCategory.image,
    templateCount: createdCategory.templateCount,
  });

  // 2. GET ALL CATEGORIES (PAGINATED & SEARCH) (GET /api/v1/template-categories)
  console.log("\n📋 2. Testing GET ALL CATEGORIES (GET /api/v1/template-categories?page=1&limit=10&search=&sortBy=createdAt&sortOrder=desc)...");
  const paginatedResult = await categoryService.getAllTemplateCategories(
    1,
    10,
    "",
    "createdAt",
    "desc"
  );
  console.log("✅ Paginated Categories Fetched:", {
    total: paginatedResult.pagination.total,
    page: paginatedResult.pagination.page,
    limit: paginatedResult.pagination.limit,
    categoriesCount: paginatedResult.categories.length,
    categories: paginatedResult.categories.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
    })),
  });

  // 3. GET CATEGORY BY ID (GET /api/v1/template-categories/:id)
  console.log("\n🔍 3. Testing GET CATEGORY BY ID (GET /api/v1/template-categories/:id)...");
  const fetchedCategory = await categoryService.getTemplateCategoryById(createdCategory.id);
  console.log("✅ Category by ID Fetched:", {
    id: fetchedCategory?.id,
    title: fetchedCategory?.title,
    slug: fetchedCategory?.slug,
    image: fetchedCategory?.image,
  });

  // 4. GET CATEGORY STATS / ALL FOR DROPDOWNS (GET /api/v1/template-categories/stats)
  console.log("\n📊 4. Testing GET CATEGORY STATS (GET /api/v1/template-categories/stats)...");
  const stats = await categoryService.getTemplateCategoryStats();
  console.log("✅ Category Stats Fetched:", stats);

  // 5. UPDATE THEME CATEGORY (PUT /api/v1/template-categories/:id)
  console.log("\n✏️ 5. Testing UPDATE THEME CATEGORY (PUT /api/v1/template-categories/:id)...");
  const updatedCategory = await categoryService.updateTemplateCategory(createdCategory.id, {
    title: "Fintech, Crypto & Banking SaaS",
    image: "https://images.unsplash.com/photo-1621416894569-0f39ed31d247?auto=format&fit=crop&w=800&q=80",
  });
  console.log("✅ Category Updated in DB:", {
    id: updatedCategory?.id,
    title: updatedCategory?.title,
    slug: updatedCategory?.slug,
    image: updatedCategory?.image,
  });

  // 6. DELETE THEME CATEGORY (DELETE /api/v1/template-categories/:id)
  console.log("\n🗑️ 6. Testing DELETE THEME CATEGORY (DELETE /api/v1/template-categories/:id)...");
  const deleteResult = await categoryService.deleteTemplateCategory(createdCategory.id);
  console.log("✅ Category Deleted:", deleteResult);

  // Verify deletion from DB
  const checkDeleted = await prisma.templateCategory.findUnique({
    where: { id: createdCategory.id },
  });
  console.log("✅ DB Verification after delete (should be null):", checkDeleted);

  // 7. Seed 4 Essential Pre-populated Categories in Database so the DB has rich categories ready for frontend
  console.log("\n🌱 7. Seeding Standard Theme Categories in DB...");
  const standardCategories = [
    {
      title: "SaaS & Tech Landing Pages",
      slug: "saas-tech-landing-pages",
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80",
    },
    {
      title: "E-Commerce & Digital Store",
      slug: "ecommerce-digital-store",
      image: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=800&q=80",
    },
    {
      title: "Portfolio & Agency",
      slug: "portfolio-agency",
      image: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80",
    },
    {
      title: "Dashboard & Admin Templates",
      slug: "dashboard-admin-templates",
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80",
    },
  ];

  for (const cat of standardCategories) {
    const upserted = await prisma.templateCategory.upsert({
      where: { slug: cat.slug },
      create: cat,
      update: cat,
    });
    console.log(`   ✓ Category Ready: ${upserted.title} (ID: ${upserted.id})`);
  }

  console.log("\n==================================================");
  console.log("🎉 ALL THEME CATEGORY APIS TESTED & STORED IN DB!");
  console.log("==================================================");
}

testThemeCategoryApis()
  .catch((err) => {
    console.error("❌ Theme category test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
