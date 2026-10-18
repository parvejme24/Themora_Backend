import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { authService } from "../src/module/auth/auth.service";
import { blogService } from "../src/module/blog/blog.service";
import { blogReviewService } from "../src/module/blog-review/blog-review.service";

const prisma = new PrismaClient();

async function main() {
  console.log("================================================================================");
  console.log("🌟 TESTING REVIEWS, COMMENTS & EMOJI REACTIONS APIS (FULL SUITE)");
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

  // Ensure a test blog post exists
  let sampleBlog = await prisma.blog.findFirst();
  if (!sampleBlog) {
    let blogCategory = await prisma.blogCategory.findFirst();
    if (!blogCategory) {
      blogCategory = await prisma.blogCategory.create({
        data: {
          title: "Engineering & Frontend",
          slug: "engineering-frontend",
        },
      });
    }

    sampleBlog = await prisma.blog.create({
      data: {
        title: "Mastering Next.js 15 App Router & Server Actions",
        slug: "mastering-nextjs-15-app-router-server-actions",
        description: "Comprehensive guide to streaming, caching, and server actions in Next.js 15.",
        readingTime: 6,
        categoryId: blogCategory.id,
        authorId: adminUser.id,
        isPublished: true,
      },
    });
  }
  console.log(`   ✓ Sample Blog ready: "${sampleBlog.title}" (ID: ${sampleBlog.id})`);

  // ---------------------------------------------------------------------------
  // 1. EMOJI REACTIONS & LIKES (BLOG ARTICLES)
  // ---------------------------------------------------------------------------
  console.log("\n😀 1. EMOJI REACTIONS & LIKES APIS...");

  // 1.1 Submit Emoji Reactions (Auth Required)
  const reactionsToTest: Array<"LIKE" | "LOVE" | "WOW" | "HAHA" | "SAD" | "ANGRY"> = ["LIKE", "LOVE", "WOW"];
  for (const rType of reactionsToTest) {
    const reactionResult = await blogService.addReaction(sampleBlog.id, standardUser.id, rType);
    console.log(`   ✓ POST /api/v1/blogs/:id/reactions: User submitted reaction "${rType}" (Success: ${!!reactionResult.reaction})`);
  }

  // 1.2 Get Reaction Counts Breakdown (Public)
  const reactionsBreakdown = await blogService.getBlogReactions(sampleBlog.id);
  console.log(`   ✓ GET /api/v1/blogs/:id/reactions: Retrieved counts breakdown:`, JSON.stringify(reactionsBreakdown));

  // 1.3 Get Current Logged-in User's Active Reaction (Auth Required)
  const userReaction = await blogService.getUserReaction(sampleBlog.id, standardUser.id);
  console.log(`   ✓ GET /api/v1/blogs/:id/reactions/user: Active reaction for ${standardUser.fullName}: ${userReaction?.reactionType}`);

  // 1.4 Quick Like/Unlike Toggle (Auth Required)
  const likeToggle1 = await blogService.toggleLike(sampleBlog.id, standardUser.id);
  console.log(`   ✓ POST /api/v1/blogs/:id/toggle-like: Toggled like (Liked = ${likeToggle1.liked}, Total Likes = ${likeToggle1.likes})`);

  // ---------------------------------------------------------------------------
  // 2. REVIEWS & COMMENTS (BLOG POSTS)
  // ---------------------------------------------------------------------------
  console.log("\n💬 2. REVIEWS & COMMENTS APIS...");

  // Clean up existing review from test user on this blog if any
  await prisma.blogReview.deleteMany({
    where: {
      blogId: sampleBlog.id,
      userId: standardUser.id,
    },
  });

  // 2.1 Post a New Review / Comment with 1-5 Star Rating (Auth Required)
  const newReview = await blogReviewService.createBlogReview({
    blogId: sampleBlog.id,
    userId: standardUser.id,
    fullName: standardUser.fullName,
    email: standardUser.email,
    rating: 5,
    commentText: "This Next.js 15 deep dive solved the caching bottlenecks in our enterprise dashboard. 5 stars!",
  });
  console.log(`   ✓ POST /api/v1/blog-reviews/:blogId: Created review "${newReview.id}" (${newReview.rating}★: "${newReview.commentText.substring(0, 45)}...")`);

  // 2.2 List Reader Reviews/Comments and Admin Replies for Blog (Public)
  const blogReviewsList = await blogReviewService.getReviewsByBlogId(sampleBlog.id, { page: 1, limit: 10 }, false);
  console.log(`   ✓ GET /api/v1/blog-reviews/:blogId: Retrieved ${blogReviewsList.reviews.length} reviews for article`);

  // 2.3 Update / Edit Review (Auth Required)
  const updatedReview = await blogReviewService.updateBlogReview(newReview.id, {
    rating: 5,
    commentText: "Updated: This Next.js 15 deep dive completely revolutionized our SSR performance. 5/5 stars!",
  });
  console.log(`   ✓ PUT /api/v1/blog-reviews/:reviewId: Updated comment text to "${updatedReview?.commentText.substring(0, 50)}..."`);

  // ---------------------------------------------------------------------------
  // 3. ADMIN REVIEW MANAGEMENT & REPLIES
  // ---------------------------------------------------------------------------
  console.log("\n🛡️ 3. ADMIN REVIEW MANAGEMENT & REPLIES APIS...");

  // 3.1 Post an Official Admin Reply (Admin)
  const adminReply = await blogReviewService.createBlogReviewReply({
    reviewId: newReview.id,
    adminId: adminUser.id,
    fullName: adminUser.fullName,
    email: adminUser.email,
    replyText: "Awesome to hear Sarah! Stay tuned for our upcoming guide on Next.js 15 Partial Prerendering (PPR).",
  });
  console.log(`   ✓ POST /api/v1/blog-reviews/reply/:reviewId: Admin replied "${adminReply.replyText.substring(0, 50)}..." (ID: ${adminReply.id})`);

  // 3.2 Moderate / Hide an Inappropriate Review (Admin)
  const hiddenReview = await blogReviewService.hideBlogReview(newReview.id);
  console.log(`   ✓ PATCH /api/v1/blog-reviews/:reviewId/hide: Hidden review status is ${hiddenReview.isHidden}`);

  // 3.3 Restore / Unhide Review (Admin)
  const unhiddenReview = await blogReviewService.unhideBlogReview(newReview.id);
  console.log(`   ✓ PATCH /api/v1/blog-reviews/:reviewId/unhide: Restored review (isHidden = ${unhiddenReview.isHidden})`);

  // 3.4 Delete a Specific Reply (Admin)
  const deleteReplySuccess = await blogReviewService.deleteBlogReviewReply(adminReply.id);
  console.log(`   ✓ DELETE /api/v1/blog-reviews/reply/:replyId: Admin reply deleted (Success = ${deleteReplySuccess})`);

  // 2.4 Delete Review (Auth Required)
  const deleteReviewSuccess = await blogReviewService.deleteBlogReview(newReview.id);
  console.log(`   ✓ DELETE /api/v1/blog-reviews/:reviewId: User deleted own review (Success = ${deleteReviewSuccess})`);

  console.log("\n================================================================================");
  console.log("🎉 ALL REVIEWS, COMMENTS & EMOJI REACTIONS APIS TESTED & PERSISTED IN DB!");
  console.log("================================================================================");
}

main()
  .catch((err) => {
    console.error("❌ Reviews, Comments & Reactions test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
