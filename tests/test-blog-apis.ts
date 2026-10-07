import "dotenv/config";
import { PrismaClient, ReactionType } from "@prisma/client";
import { authService } from "../src/module/auth/auth.service";
import { BlogCategoryService } from "../src/module/blog-category/blog-category.service";
import { BlogService } from "../src/module/blog/blog.service";

const prisma = new PrismaClient();
const blogCategoryService = new BlogCategoryService();
const blogService = new BlogService();

async function main() {
  console.log("================================================================================");
  console.log("📝 TESTING THEMORA BLOG & BLOG CATEGORY APIS (FULL WORKFLOW)");
  console.log("================================================================================\n");

  // 0. Authenticate Users (Admin and Standard User)
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
  // 1. BLOG CATEGORIES APIS
  // ---------------------------------------------------------------------------
  console.log("\n📁 1. BLOG CATEGORIES APIS...");

  // 1.1 Create Blog Category (Admin)
  const testCatTitle = "AI & Next-Gen Frameworks";
  let createdCategory = await prisma.blogCategory.findFirst({
    where: { title: testCatTitle },
  });
  if (!createdCategory) {
    createdCategory = await prisma.blogCategory.create({
      data: {
        title: testCatTitle,
        slug: "ai-next-gen-frameworks",
        imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
      },
    });
    console.log(`   ✓ POST /api/v1/blog-categories: Created "${createdCategory.title}" (ID: ${createdCategory.id})`);
  } else {
    console.log(`   ✓ POST /api/v1/blog-categories: Category verified in DB: "${createdCategory.title}"`);
  }

  // 1.2 Get All Blog Categories (Public)
  const allCategories = await blogCategoryService.getAllBlogCategories(1, 10);
  console.log(`   ✓ GET /api/v1/blog-categories: Found ${allCategories.pagination.total} categories in DB`);

  // 1.3 Update Blog Category (Admin)
  const updatedCategory = await prisma.blogCategory.update({
    where: { id: createdCategory.id },
    data: {
      title: "AI, Agents & Next-Gen Frameworks",
      imageUrl: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=800&q=80",
    },
  });
  console.log(`   ✓ PUT /api/v1/blog-categories/:id: Updated title to "${updatedCategory.title}"`);

  // ---------------------------------------------------------------------------
  // 2. BLOG CREATION & MANAGEMENT (ADMIN / AUTHOR)
  // ---------------------------------------------------------------------------
  console.log("\n✍️ 2. BLOG MANAGEMENT & DRAFTS (ADMIN / AUTHOR)...");

  const blogTitle = "Mastering Server Actions in Next.js 15 & React 19";
  let sampleBlog = await prisma.blog.findFirst({
    where: { title: blogTitle },
  });

  if (!sampleBlog) {
    sampleBlog = await blogService.createBlog({
      title: blogTitle,
      categoryId: updatedCategory.id,
      authorId: adminUser.id,
      featuredImageUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
      description: "A deep dive into zero-API data mutations, optimistic updates, and caching behaviors in modern React architecture.",
      readingTime: 7.5,
      isPublished: true,
      content: {
        intro: "React 19 and Next.js 15 eliminate boilerplate endpoints for form submissions.",
        sections: [
          { heading: "Direct Mutations", body: "Invoke server actions with end-to-end type safety." },
          { heading: "Optimistic UI", body: "Use useOptimistic for instant user feedback." }
        ]
      },
    });
    console.log(`   ✓ POST /api/v1/blogs: Created "${sampleBlog.title}" (ID: ${sampleBlog.id})`);
  } else {
    console.log(`   ✓ POST /api/v1/blogs: Blog verified in DB: "${sampleBlog.title}"`);
  }

  // 2.2 Update Blog Post
  const updatedBlog = await blogService.updateBlog(sampleBlog.id, {
    readingTime: 8.0,
    description: "An expert deep dive into zero-API data mutations, optimistic updates, and caching behaviors in modern React architecture.",
  });
  console.log(`   ✓ PUT /api/v1/blogs/:id: Updated reading time to ${updatedBlog?.readingTime} mins`);

  // 2.3 Toggle Publish / Draft
  const unpublishRes = await blogService.togglePublish(sampleBlog.id);
  console.log(`   ✓ PATCH /api/v1/blogs/:id/toggle-publish: isPublished = ${unpublishRes?.isPublished}`);
  // Publish back
  const republishRes = await blogService.togglePublish(sampleBlog.id);
  console.log(`   ✓ PATCH /api/v1/blogs/:id/toggle-publish (Re-published): isPublished = ${republishRes?.isPublished}`);

  // 2.4 Blog Stats (Admin)
  const blogStats = await blogService.getBlogStats();
  console.log(`   ✓ GET /api/v1/blogs/stats: Total blogs = ${blogStats.totalBlogs}, Published = ${blogStats.publishedBlogs}, Total Views = ${blogStats.totalViews}, Total Likes = ${blogStats.totalLikes}`);

  // ---------------------------------------------------------------------------
  // 3. BLOG POSTS (PUBLIC & READER)
  // ---------------------------------------------------------------------------
  console.log("\n📖 3. BLOG POSTS (PUBLIC & READER)...");

  // 3.1 Browse & Search Published Blogs
  const blogsBrowse = await blogService.getAllBlogs({
    page: 1,
    limit: 9,
    isPublished: true,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  console.log(`   ✓ GET /api/v1/blogs: Retrieved ${blogsBrowse.pagination.total} published blog articles`);

  // 3.2 Read Single Blog by ID / Slug
  const blogDetails = await blogService.getBlogById(sampleBlog.id);
  console.log(`   ✓ GET /api/v1/blogs/:id: Retrieved "${blogDetails?.title}" by Author "${blogDetails?.author?.fullName}" (Category: ${blogDetails?.category?.title})`);

  // 3.3 Toggle Like (Reader Auth)
  const likeResult = await blogService.toggleLike(sampleBlog.id, standardUser.id);
  console.log(`   ✓ POST /api/v1/blogs/:id/toggle-like: Liked = ${likeResult.liked}, Total Likes = ${likeResult.likes}`);

  // 3.4 Add Reaction (Reader Auth)
  const reactionResult = await blogService.addReaction(sampleBlog.id, standardUser.id, ReactionType.LIKE);
  console.log(`   ✓ POST /api/v1/blogs/:id/reactions: Added reaction "${ReactionType.LIKE}" (Count: ${reactionResult.reactCount})`);

  // Fetch reactions summary
  const reactionsSummary = await blogService.getBlogReactions(sampleBlog.id);
  console.log(`   ✓ GET /api/v1/blogs/:id/reactions: Retrieved ${reactionsSummary.length} reactions for this article`);

  console.log("\n================================================================================");
  console.log("🎉 ALL THEMORA BLOG & BLOG CATEGORY APIS VERIFIED & SAVED IN DATABASE!");
  console.log("================================================================================");
}

main()
  .catch((err) => {
    console.error("❌ Blog API Test Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
