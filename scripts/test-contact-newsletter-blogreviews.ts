import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { authService } from "../src/module/auth/auth.service";
import { contactService } from "../src/module/contact/contact.service";
import { NewsletterService } from "../src/module/newsletter/newsletter.service";
import { blogReviewService } from "../src/module/blog-review/blog-review.service";

const prisma = new PrismaClient();
const newsletterService = new NewsletterService();

async function main() {
  console.log("================================================================================");
  console.log("📬 TESTING THEMORA CONTACT, NEWSLETTER & BLOG REVIEWS APIS");
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
          title: "Design & UX",
          slug: "design-ux",
        },
      });
    }

    sampleBlog = await prisma.blog.create({
      data: {
        title: "Building High-Converting SaaS Landing Pages in 2026",
        slug: "building-high-converting-saas-landing-pages-2026",
        description: "Essential guide to modern SaaS UI/UX design patterns.",
        readingTime: 5,
        categoryId: blogCategory.id,
        authorId: adminUser.id,
        isPublished: true,
      },
    });
  }
  console.log(`   ✓ Sample Blog ready: "${sampleBlog.title}" (ID: ${sampleBlog.id})`);

  // ---------------------------------------------------------------------------
  // 1. CONTACT & CUSTOM PROJECT REQUESTS
  // ---------------------------------------------------------------------------
  console.log("\n✉️ 1. CONTACT & CUSTOM PROJECT REQUESTS APIS...");

  // 1.1 Submit Contact Message / Custom Service Request (Public / User)
  const contactSubmission = await contactService.createContact({
    fullName: "Alexander Wright",
    email: "alex.wright@innovatech.io",
    companyName: "InnovaTech Labs",
    serviceRequired: "Custom Next.js SaaS Template Development",
    budget: "$5,000 - $10,000",
    projectDetails: "We need a custom enterprise fintech dashboard with multi-tenant authentication and charts.",
    userId: standardUser.id,
  });
  console.log(`   ✓ POST /api/v1/contacts: Created contact inquiry "${contactSubmission.id}" from ${contactSubmission.fullName}`);

  // 1.2 List All Contacts (Admin)
  const contactsList = await contactService.getAllContacts({
    page: 1,
    limit: 10,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  console.log(`   ✓ GET /api/v1/contacts: Admin retrieved ${contactsList.pagination.total} customer inquiries`);

  // 1.3 Send Reply to Contact (Admin)
  const contactReply = await contactService.createContactReply({
    contactId: contactSubmission.id,
    userId: adminUser.id,
    subject: "Re: Custom Next.js SaaS Template Development Proposal",
    message: "Hi Alexander, thank you for reaching out! Our team would love to collaborate on your fintech dashboard. Let's schedule a kickoff call.",
  });
  console.log(`   ✓ POST /api/v1/contacts/:id/reply: Admin sent reply "${contactReply.subject}" to ${contactSubmission.email}`);

  // 1.4 Contact Stats (Admin)
  const contactMetrics = await contactService.getContactStats();
  console.log(`   ✓ GET /api/v1/contacts/stats: Metrics retrieved - Total Contacts: ${contactMetrics.totalContacts}, Replies: ${contactMetrics.totalReplies}`);

  // ---------------------------------------------------------------------------
  // 2. NEWSLETTER SUBSCRIPTION
  // ---------------------------------------------------------------------------
  console.log("\n📰 2. NEWSLETTER SUBSCRIPTION APIS...");

  const subscriberEmail = `alex.subscriber.${Date.now()}@innovatech.io`;

  // 2.1 Subscribe Email (Public)
  const newSubscriber = await newsletterService.subscribeNewsletter(subscriberEmail, standardUser.id);
  console.log(`   ✓ POST /api/v1/newsletter: Subscribed "${newSubscriber.email}" (ID: ${newSubscriber.id})`);

  // 2.2 List Subscribers (Admin)
  const subscribersList = await newsletterService.getAllSubscribers();
  console.log(`   ✓ GET /api/v1/newsletter: Admin retrieved ${subscribersList.length} active subscribers`);

  // 2.3 Newsletter Growth Stats (Admin)
  const newsletterGrowth = await newsletterService.getNewsletterStats("monthly");
  console.log(`   ✓ GET /api/v1/newsletter/stats: Retrieved stats for period "monthly" (Total: ${newsletterGrowth.totalSubscribers})`);

  // 2.4 Delete / Unsubscribe (Admin)
  const unsubResult = await newsletterService.deleteSubscriber(newSubscriber.id);
  console.log(`   ✓ DELETE /api/v1/newsletter/:id: Removed subscriber ${newSubscriber.id} (${unsubResult.message})`);

  // ---------------------------------------------------------------------------
  // 3. BLOG REVIEWS & COMMENTS
  // ---------------------------------------------------------------------------
  console.log("\n💬 3. BLOG REVIEWS & COMMENTS APIS...");

  // Clean up existing review from test user on this blog if any
  await prisma.blogReview.deleteMany({
    where: {
      blogId: sampleBlog.id,
      userId: standardUser.id,
    },
  });

  // 3.1 Post Blog Review / Comment (Auth Required)
  const blogReview = await blogReviewService.createBlogReview({
    blogId: sampleBlog.id,
    userId: standardUser.id,
    fullName: standardUser.fullName,
    email: standardUser.email,
    rating: 5,
    commentText: "Phenomenal insights on SaaS conversion design! The tips on micro-interactions made a huge difference in our app.",
  });
  console.log(`   ✓ POST /api/v1/blog-reviews/:blogId: User posted review (ID: ${blogReview.id}, Rating: 5★)`);

  // 3.2 Post Admin Reply (Admin)
  const reviewReply = await blogReviewService.createBlogReviewReply({
    reviewId: blogReview.id,
    adminId: adminUser.id,
    fullName: adminUser.fullName,
    email: adminUser.email,
    replyText: "Thank you so much Sarah! We're glad the SaaS micro-interaction patterns were helpful for your project.",
  });
  console.log(`   ✓ POST /api/v1/blog-reviews/reply/:reviewId: Admin replied "${reviewReply.replyText.substring(0, 50)}..."`);

  // 3.3 Get Approved Comments & Replies for an Article (Public)
  const blogComments = await blogReviewService.getReviewsByBlogId(sampleBlog.id, { page: 1, limit: 10 }, false);
  console.log(`   ✓ GET /api/v1/blog-reviews/:blogId: Retrieved ${blogComments.reviews.length} reviews with replies for blog "${sampleBlog.title}"`);

  // 3.4 Moderate / Hide Inappropriate Comment (Admin)
  const hiddenReview = await blogReviewService.hideBlogReview(blogReview.id);
  console.log(`   ✓ PATCH /api/v1/blog-reviews/:reviewId/hide: Review hidden status is ${hiddenReview.isHidden}`);

  // 3.5 Unhide Review (Admin)
  const unhiddenReview = await blogReviewService.unhideBlogReview(blogReview.id);
  console.log(`   ✓ PATCH /api/v1/blog-reviews/:reviewId/unhide: Review isVisible/unhidden (isHidden = ${unhiddenReview.isHidden})`);

  console.log("\n================================================================================");
  console.log("🎉 ALL CONTACT, NEWSLETTER & BLOG REVIEWS APIS TESTED & PERSISTED IN DB!");
  console.log("================================================================================");
}

main()
  .catch((err) => {
    console.error("❌ Contact, Newsletter & Blog Reviews test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
