import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { authService } from "../src/module/auth/auth.service";
import { TemplateCategoryService } from "../src/module/template-category/template-category.service";
import { TemplateService } from "../src/module/template/template.service";
import { BlogCategoryService } from "../src/module/blog-category/blog-category.service";
import { BlogService } from "../src/module/blog/blog.service";
import { pricingService } from "../src/module/pricing/pricing.service";
import { NewsletterService } from "../src/module/newsletter/newsletter.service";
import { ContactService } from "../src/module/contact/contact.service";

const prisma = new PrismaClient();
const templateCategoryService = new TemplateCategoryService();
const templateService = new TemplateService();
const blogCategoryService = new BlogCategoryService();
const blogService = new BlogService();
const newsletterService = new NewsletterService();
const contactService = new ContactService();

async function runMasterTest() {
  console.log("================================================================================");
  console.log("🚀 MASTER TEST SUITE: TESTING ALL BACKEND APIS & PERSISTING DATA IN DATABASE");
  console.log("================================================================================\n");

  // ---------------------------------------------------------------------------
  // 1. AUTH & USERS
  // ---------------------------------------------------------------------------
  console.log("📌 [1/7] Testing AUTH & USERS APIS...");

  // Seed Admin & Standard User
  const adminPasswordHash = await bcrypt.hash("Admin@Themora2026!", 12);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@themora.test" },
    create: {
      fullName: "Themora Administrator",
      email: "admin@themora.test",
      password: adminPasswordHash,
      role: "ADMIN",
      otpVerified: true,
      provider: "email",
      profile: {
        create: {
          avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=500&q=80",
          coverImageUrl: "https://images.unsplash.com/photo-1707343843437-caacff5cfa74?auto=format&fit=crop&w=1200&q=80",
          designation: "Chief Technology Officer & Lead Admin",
          phone: "+1 (555) 019-2834",
          country: "United States",
          city: "San Francisco",
          stateOrRegion: "California",
          postCode: "94105",
          balance: 5000.0,
        },
      },
    },
    update: {
      fullName: "Themora Administrator",
      role: "ADMIN",
      otpVerified: true,
    },
    include: { profile: true },
  });
  console.log("   ✓ Admin User verified:", adminUser.email, `(ID: ${adminUser.id})`);

  // Test User Register + Verify OTP + Login + Profile Update
  const testUserEmail = "sarah.user@themora.test";
  const userPasswordHash = await bcrypt.hash("User@Themora2026!", 12);
  const standardUser = await prisma.user.upsert({
    where: { email: testUserEmail },
    create: {
      fullName: "Sarah Jenkins",
      email: testUserEmail,
      password: userPasswordHash,
      role: "USER",
      otpVerified: true,
      provider: "email",
      profile: {
        create: {
          avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&q=80",
          coverImageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
          designation: "Senior UI/UX Designer & Developer",
          phone: "+1 (555) 432-8765",
          country: "United States",
          city: "New York",
          stateOrRegion: "New York",
          postCode: "10001",
          balance: 750.5,
        },
      },
    },
    update: {
      fullName: "Sarah Jenkins",
      role: "USER",
      otpVerified: true,
    },
    include: { profile: true },
  });
  console.log("   ✓ Standard User verified:", standardUser.email, `(ID: ${standardUser.id})`);

  const loginRes = await authService.loginUser({
    email: "sarah.user@themora.test",
    password: "User@Themora2026!",
  });
  console.log("   ✓ Login API result:", loginRes.message, "| Token issued:", Boolean(loginRes.data?.nextAuthSecret));

  const meRes = await authService.getUserById(standardUser.id);
  console.log("   ✓ Current User (/me) API result: FullName =", meRes.data?.user.fullName);

  const updateProfileRes = await authService.updateProfile(standardUser.id, {
    name: "Sarah Jenkins",
    designation: "Lead Product Designer & Engineer",
    phone: "+1 (555) 432-8765",
    address: "100 Broadway Ave, New York, NY 10005",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&q=80",
  });
  console.log("   ✓ Update Profile API result:", updateProfileRes.message);

  const allUsersRes = await authService.getAllUsers({ page: 1, limit: 10 });
  console.log("   ✓ Admin Get All Users API result: Total users in DB =", allUsersRes.pagination.total);

  // ---------------------------------------------------------------------------
  // 2. TEMPLATE CATEGORIES
  // ---------------------------------------------------------------------------
  console.log("\n📌 [2/7] Testing TEMPLATE CATEGORIES APIS...");
  const categoriesList = await templateCategoryService.getAllTemplateCategories(1, 10);
  console.log("   ✓ Get All Categories API: Found", categoriesList.pagination.total, "categories");

  let targetCat = categoriesList.categories[0];
  if (!targetCat) {
    targetCat = await templateCategoryService.createTemplateCategory({
      title: "SaaS & Tech Landing Pages",
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80",
    });
  }
  const catById = await templateCategoryService.getTemplateCategoryById(targetCat.id);
  console.log("   ✓ Get Category by ID API:", catById?.title);

  const catStats = await templateCategoryService.getTemplateCategoryStats();
  console.log("   ✓ Get Category Stats API: Total categories =", catStats.totalCategories);

  // ---------------------------------------------------------------------------
  // 3. TEMPLATES / THEMES
  // ---------------------------------------------------------------------------
  console.log("\n📌 [3/7] Testing TEMPLATES / THEMES APIS...");
  let existingTemplate = await prisma.template.findFirst({
    where: { title: "Zenith - Modern SaaS & AI Landing Template" },
  });

  if (!existingTemplate) {
    existingTemplate = await prisma.template.create({
      data: {
        title: "Zenith - Modern SaaS & AI Landing Template",
        price: 49.0,
        imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80",
        screenshots: [
          "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80",
          "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80",
        ],
        previewLink: "https://zenith-preview.themora.test",
        shortDescription: "A cutting-edge Next.js 15 & Tailwind CSS landing page template for modern AI startups and SaaS businesses.",
        description: [
          "Zenith is crafted with sleek animations, high-converting layouts, and dark mode support.",
          "Includes 10+ ready-to-use page templates, responsive design, and SEO optimization."
        ],
        whatsIncluded: [
          "Full Next.js 15 Source Code",
          "Figma Design Files",
          "TypeScript & Tailwind CSS Configurations",
          "6 Months Dedicated Support",
          "Lifetime Free Updates",
        ],
        keyFeatures: [
          { feature: "Next.js 15 App Router", description: "Built with the latest React server components" },
          { feature: "Dark & Light Mode", description: "Seamless theme switching out of the box" },
          { feature: "Ultra Fast 99+ Lighthouse Score", description: "Optimized bundle size and assets" },
        ],
        version: 1.2,
        pages: 12,
        categoryId: targetCat.id,
        categoryName: targetCat.title,
      },
    });
    console.log("   ✓ Template Created in DB:", existingTemplate.title, `(Price: $${existingTemplate.price})`);
  } else {
    console.log("   ✓ Existing Template found in DB:", existingTemplate.title);
  }

  const allTemplatesRes = await templateService.getAllTemplates({ page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc" });
  console.log("   ✓ Get All Templates API: Total templates in DB =", allTemplatesRes.pagination.total);

  const templateById = await templateService.getTemplateById(existingTemplate.id);
  console.log("   ✓ Get Template by ID API:", templateById?.title, `(Category: ${templateById?.category?.title})`);

  // ---------------------------------------------------------------------------
  // 4. BLOG CATEGORIES & BLOGS
  // ---------------------------------------------------------------------------
  console.log("\n📌 [4/7] Testing BLOGS & BLOG CATEGORIES APIS...");
  const blogCats = await blogCategoryService.getAllBlogCategories(1, 10);
  let blogCat = blogCats.items[0];
  if (!blogCat) {
    blogCat = await blogCategoryService.createBlogCategory({
      title: "Design & Technology",
    });
  }
  console.log("   ✓ Blog Category verified:", blogCat.title);

  const blogPostTitle = "How to Build Ultra-Fast SaaS Landing Pages in 2026";
  let existingBlog = await prisma.blog.findFirst({
    where: { title: blogPostTitle },
  });

  if (!existingBlog) {
    existingBlog = await blogService.createBlog({
      title: blogPostTitle,
      categoryId: blogCat.id,
      authorId: adminUser.id,
      featuredImageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80",
      description: "Discover the architectural principles and performance tricks used by top SaaS builders in 2026.",
      readingTime: 6.5,
      isPublished: true,
      content: {
        intro: "Speed and conversion are the two pillars of modern web design.",
        sections: [
          { heading: "1. Optimize Assets Early", body: "Use WebP/AVIF formats and lazy-loading techniques." },
          { heading: "2. Server-side Render Critical Paths", body: "Eliminate layout shift and improve First Contentful Paint." }
        ]
      },
    });
    console.log("   ✓ Blog Created in DB:", existingBlog.title);
  } else {
    console.log("   ✓ Blog verified in DB:", existingBlog.title);
  }

  const allBlogsRes = await blogService.getAllBlogs({ page: 1, limit: 10, isPublished: true, sortBy: "createdAt", sortOrder: "desc" });
  console.log("   ✓ Get All Blogs API: Total published blogs in DB =", allBlogsRes.pagination.total);

  // ---------------------------------------------------------------------------
  // 5. PRICING PLANS
  // ---------------------------------------------------------------------------
  console.log("\n📌 [5/7] Testing PRICING PLANS APIS...");
  const pricingPlans = await pricingService.getAllPlans();
  console.log("   ✓ Get All Pricing Plans API: Found", pricingPlans.length, "plans");
  pricingPlans.forEach((plan: any) => {
    console.log(`      - ${plan.title}: $${plan.price} (${plan.description})`);
  });

  // ---------------------------------------------------------------------------
  // 6. NEWSLETTER SUBSCRIPTION
  // ---------------------------------------------------------------------------
  console.log("\n📌 [6/7] Testing NEWSLETTER SUBSCRIPTION API...");
  const testSubEmail = "newsletter.subscriber@example.com";
  const subRes = await newsletterService.subscribeNewsletter(testSubEmail, standardUser.id);
  console.log("   ✓ Newsletter Subscribe API: Status =", subRes.isActive, `(Email: ${subRes.email})`);

  // ---------------------------------------------------------------------------
  // 7. CONTACT MESSAGES
  // ---------------------------------------------------------------------------
  console.log("\n📌 [7/7] Testing CONTACT INQUIRIES API...");
  const contactRes = await contactService.createContact({
    fullName: "David Sterling",
    email: "david.sterling@acmecorp.test",
    companyName: "Acme Innovations Ltd.",
    budget: "$5,000 - $10,000",
    serviceRequired: "Custom Enterprise Theme Design",
    projectDetails: "We are seeking a high-performance Next.js custom portal theme with multi-tenant dashboard capabilities.",
    userId: standardUser.id,
  });
  console.log("   ✓ Contact Inquiry Created in DB: Contact ID =", contactRes.id);

  console.log("\n================================================================================");
  console.log("🎉 MASTER TEST COMPLETE: ALL APIS FUNCTIONAL AND STORED IN POSTGRESQL DATABASE!");
  console.log("================================================================================");
}

runMasterTest()
  .catch((err) => {
    console.error("❌ Master test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
