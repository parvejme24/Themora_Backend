/**
 * Data for the two demo accounts on the login page, so every dashboard page
 * has something real to show:
 *
 * - Customer (sarah.user@themora.test): All-Access subscription, wishlist,
 *   support tickets, reviews, notifications, a refund request and an
 *   affiliate account with clicks, commissions and payouts.
 * - Admin (admin@themora.test): refund queue in every state, subscriptions,
 *   a payout waiting to be paid, blog drafts and notifications.
 *
 * Everything is idempotent and identifiable for --clean: orders use the
 * "seed_" prefix, subscriptions a "seed_sub_" provider id, blog drafts a
 * "seed-draft-" slug, and the rest belongs to the demo accounts.
 */
import { Prisma, PrismaClient } from "@prisma/client";

export const ADMIN_EMAIL = "admin@themora.test";
export const CUSTOMER_EMAIL = "sarah.user@themora.test";
const DEMO_DOMAIN = "demo.themora.dev";
const SUB_PREFIX = "seed_sub_";
const DRAFT_PREFIX = "seed-draft-";
const AFFILIATE_CODE = "SARAH15";

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

type User = { id: string; email: string; fullName: string };

async function demoAccounts(prisma: PrismaClient) {
  const [admin, customer] = await Promise.all(
    [ADMIN_EMAIL, CUSTOMER_EMAIL].map((email) => prisma.user.findUnique({ where: { email }, select: { id: true, email: true, fullName: true } }))
  );
  return { admin, customer };
}

const demoBuyer = (prisma: PrismaClient, name: string) =>
  prisma.user.findUnique({ where: { email: `${name}@${DEMO_DOMAIN}` }, select: { id: true, email: true, fullName: true } });

// ── Subscriptions ──────────────────────────────────────────────────────────

async function seedSubscriptions(prisma: PrismaClient, customer: User) {
  const plans = await prisma.pricingPlan.findMany({ where: { slug: { in: ["all-access-monthly", "all-access-yearly"] } } });
  const monthly = plans.find((plan) => plan.slug === "all-access-monthly");
  const yearly = plans.find((plan) => plan.slug === "all-access-yearly");
  if (!monthly || !yearly) return 0;

  const people = [
    { user: customer, plan: monthly, provider: "SSLCOMMERZ" as const, status: "ACTIVE" as const, startedDaysAgo: 12, autoRenew: false },
    { user: await demoBuyer(prisma, "emma.schneider"), plan: yearly, provider: "STRIPE" as const, status: "ACTIVE" as const, startedDaysAgo: 140, autoRenew: true },
    { user: await demoBuyer(prisma, "rahul.mehta"), plan: monthly, provider: "STRIPE" as const, status: "ACTIVE" as const, startedDaysAgo: 20, autoRenew: true },
    { user: await demoBuyer(prisma, "tanvir.hasan"), plan: monthly, provider: "SSLCOMMERZ" as const, status: "EXPIRED" as const, startedDaysAgo: 75, autoRenew: false },
    { user: await demoBuyer(prisma, "lucas.ferreira"), plan: monthly, provider: "STRIPE" as const, status: "PAST_DUE" as const, startedDaysAgo: 33, autoRenew: true },
    { user: await demoBuyer(prisma, "yuki.tanaka"), plan: yearly, provider: "STRIPE" as const, status: "CANCELLED" as const, startedDaysAgo: 210, autoRenew: false },
  ];

  let created = 0;
  for (const person of people) {
    if (!person.user) continue;
    const marker = `${SUB_PREFIX}${person.user.email}`;
    if (await prisma.subscription.findUnique({ where: { providerSubscriptionId: marker } })) continue;

    const periodDays = person.plan.billingInterval === "YEAR" ? 365 : 30;
    // Current period for live subscriptions; the last (finished) period for expired ones
    const start = daysAgo(person.status === "EXPIRED" ? person.startedDaysAgo : person.startedDaysAgo % periodDays);
    const end = new Date(start.getTime() + periodDays * DAY);
    const subscription = await prisma.subscription.create({
      data: {
        userId: person.user.id,
        pricingPlanId: person.plan.id,
        provider: person.provider,
        providerSubscriptionId: marker,
        status: person.status,
        autoRenew: person.autoRenew,
        cancelAtPeriodEnd: person.status === "CANCELLED",
        currentPeriodStart: start,
        currentPeriodEnd: end,
        createdAt: daysAgo(person.startedDaysAgo),
      },
    });
    const bdt = person.provider === "SSLCOMMERZ";
    await prisma.orderInvoice.create({
      data: {
        orderNumber: `seed_SUB-${person.user.email.split("@")[0].replace(/\W/g, "").slice(0, 10).toUpperCase()}`,
        userId: person.user.id,
        pricingPlanId: person.plan.id,
        subscriptionId: subscription.id,
        status: "COMPLETED",
        licenseType: "SINGLE",
        subtotal: person.plan.price,
        totalAmount: person.plan.price,
        provider: person.provider,
        providerPaymentId: `seed_pay_${subscription.id.slice(0, 8)}`,
        chargeAmount: bdt ? Math.round(person.plan.price * 122) : person.plan.price,
        chargeCurrency: bdt ? "BDT" : "USD",
        paymentMethod: bdt ? "bkash" : "card",
        customerEmail: person.user.email,
        customerName: person.user.fullName,
        paidAt: start,
        createdAt: start,
        items: { create: [{ pricingPlanId: person.plan.id, title: person.plan.title, unitPrice: person.plan.price, total: person.plan.price }] },
      },
    });
    created++;
  }
  return created;
}

// ── Refund requests (admin queue in every state) ───────────────────────────

async function seedRefunds(prisma: PrismaClient, admin: User, customer: User) {
  const latestOf = (userId: string) =>
    prisma.orderInvoice.findFirst({
      where: { userId, status: "COMPLETED", totalAmount: { gt: 0 }, subscriptionId: null, refundRequests: { none: {} } },
      orderBy: { createdAt: "desc" },
      select: { id: true, totalAmount: true, createdAt: true },
    });

  const cases = [
    { user: customer, status: "REQUESTED" as const, reason: "I bought the Single licence but I need it for a client project. Could I get a refund and buy the Extended one instead?" },
    { user: await demoBuyer(prisma, "oliver.bennett"), status: "REQUESTED" as const, reason: "The template doesn't support RTL layouts, which I need for an Arabic version of the site." },
    { user: await demoBuyer(prisma, "mei.lin"), status: "FAILED" as const, reason: "Charged twice for the same order by mistake.", failure: "Stripe is not configured on this server" },
    { user: await demoBuyer(prisma, "james.whitaker"), status: "REJECTED" as const, reason: "Changed my mind, I don't need it anymore.", note: "The files were downloaded and used on a live site, so this one isn't eligible. Happy to help with any setup questions though!" },
    { user: await demoBuyer(prisma, "fatima.zahra"), status: "REFUNDED" as const, reason: "Bought the wrong product, I meant to get the dashboard version.", note: "Refunded. Enjoy the dashboard version!" },
  ];

  let created = 0;
  for (const item of cases) {
    if (!item.user) continue;
    if (await prisma.refundRequest.findFirst({ where: { userId: item.user.id } })) continue;
    const order = await latestOf(item.user.id);
    if (!order) continue;
    const resolved = item.status === "REFUNDED" || item.status === "REJECTED";
    await prisma.refundRequest.create({
      data: {
        orderId: order.id,
        userId: item.user.id,
        reason: item.reason,
        status: item.status,
        amount: order.totalAmount,
        adminNote: item.note ?? null,
        failureReason: item.failure ?? null,
        providerRefundId: item.status === "REFUNDED" ? `re_seed_${order.id.slice(0, 8)}` : null,
        resolvedById: resolved ? admin.id : null,
        resolvedAt: resolved ? daysAgo(1) : null,
        createdAt: daysAgo(item.status === "REQUESTED" ? 1 : 4),
      },
    });
    if (item.status === "REFUNDED") {
      await prisma.orderInvoice.update({ where: { id: order.id }, data: { status: "REFUNDED" } });
      await prisma.license.updateMany({ where: { orderId: order.id }, data: { isActive: false } });
    }
    created++;
  }
  return created;
}

// ── Customer: wishlist, reviews, tickets ───────────────────────────────────

async function ownedProductIds(prisma: PrismaClient, userId: string) {
  const orders = await prisma.orderInvoice.findMany({
    where: { userId, status: "COMPLETED" },
    select: { templateId: true, items: { select: { productId: true } } },
  });
  return [...new Set(orders.flatMap((order) => [order.templateId, ...order.items.map((item) => item.productId)]).filter((id): id is string => !!id))];
}

async function seedWishlist(prisma: PrismaClient, customer: User) {
  const owned = await ownedProductIds(prisma, customer.id);
  const products = await prisma.template.findMany({
    where: { status: "PUBLISHED", id: { notIn: owned } },
    orderBy: [{ isFeatured: "desc" }, { totalPurchase: "desc" }],
    take: 5,
    select: { id: true },
  });
  const result = await prisma.wishlistItem.createMany({
    data: products.map((product, index) => ({ userId: customer.id, productId: product.id, createdAt: daysAgo(index * 3 + 1) })),
    skipDuplicates: true,
  });
  return result.count;
}

const customerReviews = [
  { rating: 5, title: "Saved me weeks of work", body: "Clean code, sensible folder structure and the docs actually match the code. I had a client demo running the same afternoon." },
  { rating: 4, title: "Great design, small setup hiccup", body: "Looks fantastic on mobile. The environment setup took a bit of trial and error, but support answered within a few hours." },
];

async function seedReviews(prisma: PrismaClient, customer: User) {
  const owned = await ownedProductIds(prisma, customer.id);
  let created = 0;
  for (const [index, productId] of owned.slice(0, customerReviews.length).entries()) {
    const exists = await prisma.productReview.findUnique({ where: { productId_userId: { productId, userId: customer.id } } });
    if (exists) continue;
    await prisma.productReview.create({
      data: { productId, userId: customer.id, ...customerReviews[index], isVerifiedBuyer: true, createdAt: daysAgo(6 + index * 9) },
    });
    const stats = await prisma.productReview.aggregate({ where: { productId, status: "APPROVED" }, _avg: { rating: true }, _count: { _all: true } });
    await prisma.template.update({
      where: { id: productId },
      data: { avgRating: Math.round((stats._avg.rating ?? 0) * 10) / 10, reviewCount: stats._count._all },
    });
    created++;
  }
  return created;
}

async function seedTickets(prisma: PrismaClient, admin: User, customer: User) {
  if (await prisma.supportTicket.count({ where: { userId: customer.id } })) return 0;
  const [productId] = await ownedProductIds(prisma, customer.id);
  const order = await prisma.orderInvoice.findFirst({ where: { userId: customer.id, status: "COMPLETED" }, orderBy: { createdAt: "desc" }, select: { id: true } });

  await prisma.supportTicket.create({
    data: {
      userId: customer.id,
      productId: productId ?? null,
      subject: "Licence won't activate on my staging domain",
      status: "AWAITING_CUSTOMER",
      priority: "HIGH",
      assignedToId: admin.id,
      lastMessageAt: daysAgo(0.2),
      createdAt: daysAgo(1),
      messages: {
        create: [
          { authorId: customer.id, body: "I activated my licence on example.com, but staging.example.com says the licence limit is reached. Is staging counted as a second site?", createdAt: daysAgo(1) },
          { authorId: admin.id, isStaff: true, body: "Hi Sarah! Staging and localhost domains are free, but they need to be added as a subdomain of the activated site. Could you remove the staging activation in My library and add it again? It should go through now.", createdAt: daysAgo(0.2) },
        ],
      },
    },
  });
  await prisma.supportTicket.create({
    data: {
      userId: customer.id,
      orderId: order?.id ?? null,
      subject: "Invoice with my company name",
      status: "RESOLVED",
      priority: "LOW",
      lastMessageAt: daysAgo(8),
      createdAt: daysAgo(10),
      messages: {
        create: [
          { authorId: customer.id, body: "Could you add my company name (Jenkins Studio) to the invoice for my last order?", createdAt: daysAgo(10) },
          { authorId: admin.id, isStaff: true, body: "Done! Open the order in your dashboard and print the invoice again: the billing name now shows Jenkins Studio.", createdAt: daysAgo(9) },
          { authorId: customer.id, body: "Perfect, thank you!", createdAt: daysAgo(8) },
        ],
      },
    },
  });
  await prisma.supportTicket.create({
    data: {
      userId: customer.id,
      subject: "Will the dashboard kit get a dark mode?",
      status: "AWAITING_SUPPORT",
      lastMessageAt: daysAgo(0.05),
      messages: { create: [{ authorId: customer.id, body: "Love the dashboard kit. Is a dark mode on the roadmap? I'd happily wait for it instead of building my own.", createdAt: daysAgo(0.05) }] },
    },
  });
  return 3;
}

// ── Customer: affiliate account ────────────────────────────────────────────

async function seedAffiliate(prisma: PrismaClient, customer: User) {
  const affiliate = await prisma.affiliate.upsert({
    where: { userId: customer.id },
    create: {
      userId: customer.id,
      code: AFFILIATE_CODE,
      status: "ACTIVE",
      commissionRate: 0.2,
      payoutMethod: "bkash",
      payoutDetails: "01711000000",
      website: "https://sarahjenkins.design",
      approvedAt: daysAgo(90),
      createdAt: daysAgo(95),
    },
    update: {},
  });
  if (await prisma.referral.count({ where: { affiliateId: affiliate.id } })) return 0;

  await prisma.affiliateClick.createMany({
    data: Array.from({ length: 96 }, (_, i) => ({
      affiliateId: affiliate.id,
      visitorHash: `seed-sarah-visitor-${i}`,
      landingPath: ["/", "/products", "/pricing", "/products?type=UI_KIT"][i % 4],
      referrer: ["https://sarahjenkins.design/resources", "https://dribbble.com", "https://www.linkedin.com"][i % 3],
      createdAt: daysAgo((i * 7) % 85),
    })),
  });

  // Other demo buyers' orders that no affiliate has been credited for
  const orders = await prisma.orderInvoice.findMany({
    where: {
      orderNumber: { startsWith: "seed_" },
      status: "COMPLETED",
      affiliateId: null,
      subscriptionId: null,
      referral: null,
      user: { email: { endsWith: `@${DEMO_DOMAIN}` } },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, totalAmount: true, createdAt: true },
  });
  if (!orders.length) return 0;

  const commission = (amount: number) => Math.round(amount * 20) / 100;
  // 3 paid, 3 approved (in a payout waiting for the admin), 2 still on hold
  const paid = orders.slice(0, 3);
  const approved = orders.slice(3, 6);
  const paidPayout = await prisma.affiliatePayout.create({
    data: {
      affiliateId: affiliate.id,
      amount: Math.round(paid.reduce((sum, order) => sum + commission(order.totalAmount), 0) * 100) / 100,
      method: "bkash",
      details: "01711000000",
      status: "PAID",
      reference: "bKash TX SEED5RH2KQ",
      paidAt: daysAgo(18),
      createdAt: daysAgo(21),
    },
  });
  const requested = approved.length
    ? await prisma.affiliatePayout.create({
        data: {
          affiliateId: affiliate.id,
          amount: Math.round(approved.reduce((sum, order) => sum + commission(order.totalAmount), 0) * 100) / 100,
          method: "bkash",
          details: "01711000000",
          status: "REQUESTED",
          createdAt: daysAgo(2),
        },
      })
    : null;

  for (const [index, order] of orders.entries()) {
    const status = index < 3 ? "PAID" : index < 6 ? "APPROVED" : "PENDING";
    await prisma.orderInvoice.update({ where: { id: order.id }, data: { affiliateId: affiliate.id } });
    await prisma.referral.create({
      data: {
        affiliateId: affiliate.id,
        orderId: order.id,
        orderAmount: order.totalAmount,
        commission: commission(order.totalAmount),
        status,
        approvableAt: status === "PENDING" ? daysAgo(-9) : new Date(order.createdAt.getTime() + 14 * DAY),
        payoutId: status === "PAID" ? paidPayout.id : status === "APPROVED" ? requested?.id ?? null : null,
        createdAt: order.createdAt,
      },
    });
  }
  return orders.length;
}

// ── Notifications ──────────────────────────────────────────────────────────

async function seedNotifications(prisma: PrismaClient, admin: User, customer: User) {
  let created = 0;
  const add = async (user: User, rows: Omit<Prisma.NotificationCreateManyInput, "userId">[]) => {
    if (await prisma.notification.count({ where: { userId: user.id } })) return;
    const result = await prisma.notification.createMany({ data: rows.map((row) => ({ ...row, userId: user.id })) });
    created += result.count;
  };

  await add(customer, [
    { type: "ticket_reply", title: "Support replied to “Licence won't activate on my staging domain”", body: "Staging and localhost domains are free, but they need to be added as a subdomain…", link: "/dashboard/support", createdAt: daysAgo(0.2) },
    { type: "product_update", title: "A new version of one of your products is out", body: "Version 2.4 adds dark mode and fixes the mobile menu.", link: "/dashboard/library", createdAt: daysAgo(2) },
    { type: "refund_update", title: "We received your refund request", body: "The team usually replies within 2 business days.", link: "/dashboard/orders", createdAt: daysAgo(1) },
    { type: "payout_paid", title: "Affiliate payout sent", body: "Your commission was sent to bKash 01711000000.", link: "/dashboard/affiliate", readAt: daysAgo(17), createdAt: daysAgo(18) },
    { type: "order_completed", title: "Your All-Access pass is active", body: "Download any product for the next 30 days.", link: "/dashboard/subscription", readAt: daysAgo(11), createdAt: daysAgo(12) },
    { type: "ticket_reply", title: "Support replied to “Invoice with my company name”", link: "/dashboard/support", readAt: daysAgo(8), createdAt: daysAgo(9) },
  ]);
  await add(admin, [
    { type: "refund_update", title: "New refund request from Sarah Jenkins", body: "Single → Extended licence for a client project.", link: "/dashboard/refunds", createdAt: daysAgo(1) },
    { type: "ticket_assigned", title: "Ticket assigned to you: “Licence won't activate on my staging domain”", link: "/dashboard/tickets", createdAt: daysAgo(1) },
    { type: "payout_paid", title: "Payout requested by affiliate SARAH15", body: "Approved commission is waiting to be paid by bKash.", link: "/dashboard/affiliates", createdAt: daysAgo(2) },
    { type: "order_completed", title: "New All-Access yearly subscriber", body: "Emma Schneider renewed for another year.", link: "/dashboard/subscriptions-admin", readAt: daysAgo(3), createdAt: daysAgo(4) },
    { type: "refund_update", title: "Gateway refund failed for Mei Lin", body: "Stripe is not configured on this server. Retry once the keys are added.", link: "/dashboard/refunds", readAt: daysAgo(3), createdAt: daysAgo(4) },
  ]);
  return created;
}

// ── Blog drafts ────────────────────────────────────────────────────────────

const drafts = [
  {
    slug: `${DRAFT_PREFIX}choosing-a-saas-starter`,
    title: "How to choose a SaaS starter kit in 2026",
    description: "Auth, billing, teams and admin: what to look for before you buy a SaaS boilerplate, and the questions to ask the author.",
    readingTime: 7,
  },
  {
    slug: `${DRAFT_PREFIX}flutter-vs-react-native`,
    title: "Flutter vs React Native for your next client app",
    description: "We shipped the same food-delivery app in both. Here's what was faster to build, what was faster to run, and what clients noticed.",
    readingTime: 9,
  },
];

async function seedBlogDrafts(prisma: PrismaClient, admin: User) {
  const category = await prisma.blogCategory.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!category) return 0;
  let created = 0;
  for (const [index, draft] of drafts.entries()) {
    if (await prisma.blog.findUnique({ where: { slug: draft.slug } })) continue;
    await prisma.blog.create({
      data: {
        ...draft,
        categoryId: category.id,
        authorId: admin.id,
        isPublished: false,
        featuredImageUrl: `https://picsum.photos/seed/${draft.slug}/1200/630`,
        createdAt: daysAgo(index + 1),
      },
    });
    created++;
  }
  return created;
}

// ── Entry points ───────────────────────────────────────────────────────────

export async function seedDemoAccounts(prisma: PrismaClient) {
  const { admin, customer } = await demoAccounts(prisma);
  if (!admin || !customer) {
    console.log(`⏭  Skipped demo-account data (${ADMIN_EMAIL} or ${CUSTOMER_EMAIL} does not exist)`);
    return;
  }
  const counts = {
    subscriptions: await seedSubscriptions(prisma, customer),
    refunds: await seedRefunds(prisma, admin, customer),
    wishlist: await seedWishlist(prisma, customer),
    reviews: await seedReviews(prisma, customer),
    tickets: await seedTickets(prisma, admin, customer),
    referrals: await seedAffiliate(prisma, customer),
    notifications: await seedNotifications(prisma, admin, customer),
    blogDrafts: await seedBlogDrafts(prisma, admin),
  };
  console.log(`🧑‍💼 Demo accounts: ${Object.entries(counts).map(([key, count]) => `${count} ${key}`).join(", ")}`);
}

export async function cleanDemoAccounts(prisma: PrismaClient) {
  const { customer } = await demoAccounts(prisma);
  // Subscription orders use the seed_ prefix and are removed with the other demo orders
  await prisma.subscription.deleteMany({ where: { providerSubscriptionId: { startsWith: SUB_PREFIX } } });
  await prisma.blog.deleteMany({ where: { slug: { startsWith: DRAFT_PREFIX } } });
  const users = [ADMIN_EMAIL, CUSTOMER_EMAIL];
  await prisma.notification.deleteMany({ where: { user: { email: { in: users } } } });
  if (customer) {
    await prisma.refundRequest.deleteMany({ where: { userId: customer.id } });
    await prisma.wishlistItem.deleteMany({ where: { userId: customer.id } });
    await prisma.supportTicket.deleteMany({ where: { userId: customer.id } });
    await prisma.affiliate.deleteMany({ where: { userId: customer.id, code: AFFILIATE_CODE } });
    const reviewed = await prisma.productReview.findMany({ where: { userId: customer.id }, select: { productId: true } });
    await prisma.productReview.deleteMany({ where: { userId: customer.id } });
    for (const { productId } of reviewed) {
      const stats = await prisma.productReview.aggregate({ where: { productId, status: "APPROVED" }, _avg: { rating: true }, _count: { _all: true } });
      await prisma.template.update({ where: { id: productId }, data: { avgRating: Math.round((stats._avg.rating ?? 0) * 10) / 10, reviewCount: stats._count._all } });
    }
  }
  console.log("🧹 Removed demo-account data (subscriptions, refunds, tickets, wishlist, reviews, affiliate, notifications, blog drafts)");
}
