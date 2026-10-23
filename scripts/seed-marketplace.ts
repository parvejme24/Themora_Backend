/**
 * Seeds the marketplace with realistic demo data: categories, ~30 products,
 * demo buyers, completed orders and reviews. Safe to run repeatedly (upserts).
 *
 *   npm run seed:marketplace           # create or refresh demo data
 *   npm run seed:marketplace -- --clean  # remove all demo data again
 *
 * Every demo record is identifiable: buyers use @demo.themora.dev emails,
 * orders use a "seed_" order ID, and products are listed in seed-data/catalog.ts.
 * The login page's demo accounts get dashboard data from seed-data/demo-accounts.ts.
 * Run --clean before real customers use the store.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { v2 as cloudinary } from "cloudinary";
import { LicenseType, Prisma, PrismaClient } from "@prisma/client";
import {
  baseCategories,
  existingProductEnrichment,
  seedCategories,
  seedProducts,
  whatsIncludedByType,
} from "./seed-data/catalog";
import { reviewPool } from "./seed-data/reviews";
import { cleanDemoAccounts, seedDemoAccounts } from "./seed-data/demo-accounts";

const prisma = new PrismaClient({ transactionOptions: { maxWait: 10_000, timeout: 60_000 } });

const DEMO_DOMAIN = "demo.themora.dev";
const SEED_ORDER_PREFIX = "seed_";
const CONCURRENCY = 8;

const demoBuyers = [
  "Ayesha Rahman", "Daniel Okafor", "Sofia Martínez", "Tanvir Hasan", "Emma Schneider",
  "Rahul Mehta", "Lucas Ferreira", "Nadia Islam", "James Whitaker", "Yuki Tanaka",
  "Fatima Zahra", "Oliver Bennett", "Mei Lin", "Arif Chowdhury",
];

const slugify = (text: string) =>
  text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Deterministic PRNG so re-running the seed produces the same data
const createRandom = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const random = createRandom(2026);
const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const image = (slug: string, variant = "cover") => `https://picsum.photos/seed/themora-${slug}-${variant}/1200/800`;

// The database is remote, so run independent writes concurrently in small batches
const inBatches = async <T>(items: T[], worker: (item: T) => Promise<unknown>) => {
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    await Promise.all(items.slice(i, i + CONCURRENCY).map(worker));
  }
};

async function recountCategories() {
  const counts = await prisma.template.groupBy({ by: ["categoryId"], _count: { _all: true } });
  const byCategory = new Map(counts.map((row) => [row.categoryId, row._count._all]));
  const categories = await prisma.templateCategory.findMany({ select: { id: true } });
  await inBatches(categories, (category) =>
    prisma.templateCategory.update({
      where: { id: category.id },
      data: { templateCount: byCategory.get(category.id) ?? 0 },
    })
  );
}

async function clean() {
  await cleanDemoAccounts(prisma);
  const orders = await prisma.orderInvoice.deleteMany({ where: { orderNumber: { startsWith: SEED_ORDER_PREFIX } } });
  const users = await prisma.user.deleteMany({ where: { email: { endsWith: `@${DEMO_DOMAIN}` } } });

  const slugs = seedProducts.map((p) => p.slug);
  const withRealOrders = await prisma.template.findMany({
    where: { slug: { in: slugs }, orders: { some: {} } },
    select: { slug: true },
  });
  const keep = new Set(withRealOrders.map((p) => p.slug));
  const products = await prisma.template.deleteMany({ where: { slug: { in: slugs.filter((s) => !keep.has(s)) } } });
  if (keep.size) {
    await prisma.template.updateMany({ where: { slug: { in: [...keep] } }, data: { status: "ARCHIVED" } });
  }

  const categories = await prisma.templateCategory.deleteMany({
    where: { slug: { in: seedCategories.map((c) => c.slug) }, templates: { none: {} } },
  });
  await prisma.tag.deleteMany({ where: { products: { none: {} } } });
  await recountCategories();
  const coupons = await prisma.coupon.deleteMany({
    where: { code: { in: [...seedCoupons.map((c) => c.code), seedCouponCategory.code] }, redemptions: { none: {} } },
  });
  const plans = await prisma.pricingPlan.deleteMany({
    where: { slug: { in: seedPlans.map((p) => p.slug) }, orderItems: { none: {} }, subscriptions: { none: {} } },
  });
  console.log(`🧹 Removed ${coupons.count} demo coupons and ${plans.count} unused demo plans`);

  console.log(
    `🧹 Removed ${orders.count} demo orders, ${users.count} demo buyers (and their reviews), ` +
      `${products.count} demo products, ${categories.count} empty demo categories` +
      (keep.size ? `; archived ${keep.size} products that have real orders` : "")
  );
}

async function seedCatalog() {
  await inBatches(baseCategories, (category) =>
    prisma.templateCategory.upsert({ where: { slug: category.slug }, create: category, update: {} })
  );
  await inBatches(seedCategories, (category) =>
    prisma.templateCategory.upsert({ where: { slug: category.slug }, create: category, update: { title: category.title } })
  );
  const categories = await prisma.templateCategory.findMany({ select: { id: true, slug: true, title: true } });
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

  // Create tags up front so concurrent product writes only connect to them
  const tagNames = new Map(seedProducts.flatMap((p) => p.tags).map((name) => [slugify(name), name]));
  await inBatches([...tagNames], ([slug, name]) => prisma.tag.upsert({ where: { slug }, create: { slug, name }, update: {} }));

  await inBatches([...seedProducts.entries()], async ([index, product]) => {
    const category = categoryBySlug.get(product.category);
    if (!category) throw new Error(`Unknown category "${product.category}" for ${product.slug}`);

    const tags = product.tags.map((name) => ({ slug: slugify(name) }));
    const data = {
      title: product.title,
      productType: product.productType,
      status: "PUBLISHED" as const,
      price: product.isFree ? 0 : product.price,
      salePrice: product.salePrice ?? null,
      extendedPrice: product.extendedPrice ?? null,
      isFree: product.isFree ?? false,
      isFeatured: product.isFeatured ?? false,
      techStack: product.techStack,
      platforms: product.platforms,
      shortDescription: product.shortDescription,
      description: product.description,
      whatsIncluded: whatsIncludedByType[product.productType],
      keyFeatures: product.keyFeatures as Prisma.InputJsonValue[],
      imageUrl: image(product.slug),
      screenshots: [1, 2, 3, 4].map((n) => image(product.slug, `shot-${n}`)),
      version: product.version,
      pages: product.pages,
      fileSize: product.fileSize,
      totalPurchase: product.totalPurchase,
      downloads: product.downloads,
      viewCount: product.viewCount,
      categoryName: category.title,
      category: { connect: { id: category.id } },
    };

    // Spread publish dates over the last ~8 months so "newest" sorting looks natural
    const publishedAt = daysAgo(240 - index * 8);
    await prisma.template.upsert({
      where: { slug: product.slug },
      create: { ...data, slug: product.slug, publishedAt, createdAt: publishedAt, tags: { connect: tags } },
      update: { ...data, tags: { set: tags } },
    });
  });

  let enriched = 0;
  await inBatches(Object.entries(existingProductEnrichment), async ([title, meta]) => {
    const result = await prisma.template.updateMany({ where: { title, techStack: { isEmpty: true } }, data: meta });
    enriched += result.count;
  });

  await recountCategories();
  console.log(
    `📦 Upserted ${baseCategories.length + seedCategories.length} categories, ${tagNames.size} tags and ` +
      `${seedProducts.length} products; enriched ${enriched} existing products`
  );
}

async function seedBuyers() {
  const password = await bcrypt.hash("DemoBuyer!2026", 10);
  const users: { id: string; email: string; fullName: string }[] = [];
  await inBatches([...demoBuyers.entries()], async ([index, fullName]) => {
    const email = `${slugify(fullName).replace(/-/g, ".")}@${DEMO_DOMAIN}`;
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        fullName,
        email,
        password,
        role: "USER",
        otpVerified: true,
        provider: "email",
        createdAt: daysAgo(300 - index * 15),
        profile: { create: { avatarUrl: `https://i.pravatar.cc/150?u=${encodeURIComponent(email)}` } },
      },
      update: { fullName },
    });
    users[index] = user;
  });
  console.log(`👥 Upserted ${users.length} demo buyers (password: DemoBuyer!2026)`);
  return users;
}

interface PlannedReview {
  user: { id: string; email: string; fullName: string };
  orderId: string;
  purchasedAt: Date;
  licenseType: LicenseType;
  paymentMethod: string;
  rating: number;
  text: { title: string; body: string };
}

async function seedOrdersAndReviews(users: { id: string; email: string; fullName: string }[]) {
  const products = await prisma.template.findMany({
    where: { slug: { in: seedProducts.map((p) => p.slug) } },
    orderBy: { slug: "asc" },
    select: { id: true, slug: true, title: true, price: true, salePrice: true, isFree: true },
  });

  // Plan all random choices first, in a fixed order, so the data is the same on every run
  const plans = products.map((product) => {
    const reviewerCount = 3 + Math.floor(random() * 6);
    const reviewers = [...users].sort(() => random() - 0.5).slice(0, reviewerCount);
    const reviews: PlannedReview[] = reviewers.map((user, index) => {
      const purchasedAt = daysAgo(10 + Math.floor(random() * 170));
      const licenseType: LicenseType = random() < 0.2 ? "EXTENDED" : "SINGLE";
      const paymentMethod = pick(["card", "card", "bkash", "nagad"]);
      // Ratings skew positive, like real marketplaces
      const roll = random();
      const rating = roll < 0.55 ? 5 : roll < 0.85 ? 4 : roll < 0.95 ? 3 : 2;
      return {
        user,
        orderId: `${SEED_ORDER_PREFIX}${product.slug}_${index}`,
        purchasedAt,
        licenseType,
        paymentMethod,
        rating,
        text: pick(reviewPool[rating]),
      };
    });
    return { product, reviews };
  });

  let orders = 0;
  let reviews = 0;
  await inBatches(plans, async ({ product, reviews: planned }) => {
    await Promise.all(
      planned.map(async (plan) => {
        if (!product.isFree) {
          const price = product.salePrice ?? product.price;
          await prisma.orderInvoice.upsert({
            where: { orderNumber: plan.orderId },
            create: {
              orderNumber: plan.orderId,
              userId: plan.user.id,
              templateId: product.id,
              status: "COMPLETED",
              subtotal: price,
              totalAmount: price,
              currency: "USD",
              provider: plan.paymentMethod === "card" ? "STRIPE" : "SSLCOMMERZ",
              chargeAmount: plan.paymentMethod === "card" ? price : Math.round(price * 122),
              chargeCurrency: plan.paymentMethod === "card" ? "USD" : "BDT",
              paidAt: plan.purchasedAt,
              items: {
                create: [{ productId: product.id, title: `${product.title} (${plan.licenseType === "EXTENDED" ? "Extended" : "Single"} licence)`, licenseType: plan.licenseType, unitPrice: price, total: price }],
              },
              licenseType: plan.licenseType,
              paymentMethod: plan.paymentMethod,
              customerEmail: plan.user.email,
              customerName: plan.user.fullName,
              createdAt: plan.purchasedAt,
            },
            update: {},
          });
          orders++;
        }
        await prisma.productReview.upsert({
          where: { productId_userId: { productId: product.id, userId: plan.user.id } },
          create: {
            productId: product.id,
            userId: plan.user.id,
            rating: plan.rating,
            title: plan.text.title,
            body: plan.text.body,
            isVerifiedBuyer: !product.isFree,
            createdAt: new Date(plan.purchasedAt.getTime() + 3 * 24 * 60 * 60 * 1000),
          },
          update: {},
        });
        reviews++;
      })
    );

    const stats = await prisma.productReview.aggregate({
      where: { productId: product.id, status: "APPROVED" },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await prisma.template.update({
      where: { id: product.id },
      data: { avgRating: Math.round((stats._avg.rating ?? 0) * 10) / 10, reviewCount: stats._count._all },
    });
  });

  // Seller replies on critical reviews
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true } });
  let replies = 0;
  if (admin) {
    const critical = await prisma.productReview.findMany({
      where: { rating: { lte: 3 }, user: { email: { endsWith: `@${DEMO_DOMAIN}` } }, replies: { none: {} } },
      take: 10,
    });
    await prisma.productReviewReply.createMany({
      data: critical.map((review) => ({
        reviewId: review.id,
        userId: admin.id,
        body: "Thanks for the honest feedback! We've addressed this in the latest update — download the new version from your dashboard, and contact support if anything is still unclear.",
      })),
    });
    replies = critical.length;
  }

  console.log(`🧾 Upserted ${orders} completed demo orders and ${reviews} reviews; added ${replies} seller replies`);
}

const seedPlans = [
  {
    slug: "all-access-monthly",
    title: "All-Access Monthly",
    description: "Every product in the store, every update, cancel anytime",
    price: 29,
    billingInterval: "MONTH" as const,
    features: ["Download every template, app and UI kit", "All future releases included", "Commercial use licence", "Priority support", "Cancel anytime"],
    sortOrder: 10,
  },
  {
    slug: "all-access-yearly",
    title: "All-Access Yearly",
    description: "Everything in monthly, two months free",
    price: 249,
    billingInterval: "YEAR" as const,
    recommended: true,
    features: ["Download every template, app and UI kit", "All future releases included", "Commercial use licence", "Priority support", "Two months free"],
    sortOrder: 11,
  },
];

const seedCoupons = [
  { code: "WELCOME10", description: "10% off your first order", type: "PERCENT" as const, value: 10, firstOrderOnly: true },
  { code: "BLACKFRIDAY40", description: "Black Friday: 40% off everything", type: "PERCENT" as const, value: 40, maxDiscount: 200, maxUses: 1000, endsAt: new Date("2026-12-01T23:59:59Z") },
  { code: "SAVE15", description: "$15 off orders over $75", type: "FIXED" as const, value: 15, minSubtotal: 75, perUserLimit: 1 },
];
const seedCouponCategory = { code: "FLUTTER20", description: "20% off Flutter apps", type: "PERCENT" as const, value: 20, categorySlug: "flutter" };
const flashSaleSlugs = ["aurora-ai-startup-landing", "pulse-react-native-fitness", "glyph-mobile-ui-kit", "crmify-sales-crm-dashboard"];

async function seedCommerce() {
  await inBatches(seedPlans, (plan) =>
    prisma.pricingPlan.upsert({
      where: { slug: plan.slug },
      create: { ...plan, currency: "USD", grantsAllAccess: true, isActive: true },
      update: { price: plan.price, features: plan.features, billingInterval: plan.billingInterval, grantsAllAccess: true },
    })
  );

  const flutter = await prisma.templateCategory.findUnique({ where: { slug: seedCouponCategory.categorySlug }, select: { id: true } });
  const { categorySlug, ...categoryCoupon } = seedCouponCategory;
  await inBatches([...seedCoupons, { ...categoryCoupon, categoryIds: flutter ? [flutter.id] : [] }], (coupon) =>
    prisma.coupon.upsert({ where: { code: coupon.code }, create: coupon, update: {} })
  );

  // A running flash sale: 30% off a few products for the next 7 days
  const saleEndsAt = daysAgo(-7);
  const onSale = await prisma.template.findMany({ where: { slug: { in: flashSaleSlugs } }, select: { id: true, price: true } });
  await inBatches(onSale, (product) =>
    prisma.template.update({ where: { id: product.id }, data: { salePrice: Math.round(product.price * 70) / 100, saleEndsAt } })
  );

  console.log(`🏷  Upserted ${seedPlans.length} all-access plans, ${seedCoupons.length + 1} coupons; ${onSale.length} products on a 7-day flash sale`);
}

const changelogPool = [
  ["Added dark mode support across all pages", "Improved Lighthouse performance score to 98", "Fixed mobile menu closing on route change"],
  ["Upgraded to the latest framework version", "New pricing and FAQ sections", "Accessibility fixes for keyboard navigation"],
  ["Added RTL language support", "New dashboard widgets", "Fixed form validation messages"],
  ["Updated all dependencies", "New onboarding screens", "Bug fixes and performance improvements"],
  ["Initial release"],
];

const DEMO_PACKAGE = `# Themora demo source package

This file stands in for a real product download in the Themora demo store.
Real products ship their full source code archive here.

Licence keys, versions and download links in the demo work exactly like the live store.
`;

// One small private file on Cloudinary that every demo version points to,
// so the secure download flow can be tried end to end
async function uploadDemoPackage(): Promise<string | null> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.CLAUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY || process.env.CLAUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET || process.env.CLAUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  try {
    const result = await cloudinary.uploader.upload(`data:text/markdown;base64,${Buffer.from(DEMO_PACKAGE).toString("base64")}`, {
      resource_type: "raw",
      type: "authenticated",
      public_id: "themora/source-files/demo-source-package.md",
      overwrite: true,
    });
    return result.public_id;
  } catch (error) {
    console.warn("⚠️  Could not upload the demo package to Cloudinary; versions will be created without files", error);
    return null;
  }
}

async function seedVersions() {
  // Without Cloudinary the release history is still created, just without files
  const cloudinaryId = await uploadDemoPackage();
  const products = await prisma.template.findMany({
    // Seed products plus the older demo products (e.g. Zenith) enriched above
    where: { OR: [{ slug: { in: seedProducts.map((p) => p.slug) } }, { title: { in: Object.keys(existingProductEnrichment) } }] },
    select: { id: true, slug: true, version: true, publishedAt: true },
  });

  let created = 0;
  await inBatches(products, async (product) => {
    const major = Math.floor(product.version);
    const minor = Math.round((product.version - major) * 10);
    // e.g. 3.2 → 3.0, 3.1, 3.2 (at most three releases)
    const releases = Array.from({ length: Math.min(minor + 1, 3) }, (_, i) => `${major}.${minor - i}`).reverse();
    const start = product.publishedAt ?? daysAgo(200);

    for (const [index, version] of releases.entries()) {
      const isLatest = index === releases.length - 1;
      const lines = index === 0 && releases.length > 1 ? changelogPool[4] : changelogPool[(index + product.slug.length) % 4];
      const existing = await prisma.productVersion.findUnique({ where: { productId_version: { productId: product.id, version } } });
      if (existing) continue;
      await prisma.productVersion.create({
        data: {
          productId: product.id,
          version,
          changelog: lines.map((line) => `- ${line}`).join("\n"),
          isLatest,
          releasedAt: new Date(Math.min(start.getTime() + index * 30 * 24 * 60 * 60 * 1000, Date.now() - (releases.length - 1 - index) * 86_400_000)),
          ...(cloudinaryId ? { files: { create: [{ name: `${product.slug}-v${version}.md`, cloudinaryId, size: DEMO_PACKAGE.length }] } } : {}),
        },
      });
      created++;
    }
  });
  console.log(`🗂  Created ${created} product versions${cloudinaryId ? " (files point to the private demo package)" : " without files (Cloudinary not configured)"}`);
}

// A demo affiliate with clicks, commissions in every state and a paid payout
async function seedAffiliate() {
  const user = await prisma.user.findUnique({ where: { email: `ayesha.rahman@${DEMO_DOMAIN}` }, select: { id: true } });
  if (!user) return;
  const affiliate = await prisma.affiliate.upsert({
    where: { userId: user.id },
    create: { userId: user.id, code: "AYESHA20", status: "ACTIVE", commissionRate: 0.2, payoutMethod: "bkash", payoutDetails: "01700000000", website: "https://ayesha.dev", approvedAt: daysAgo(200) },
    update: {},
  });
  if ((await prisma.referral.count({ where: { affiliateId: affiliate.id } })) > 0) return;

  await prisma.affiliateClick.createMany({
    data: Array.from({ length: 180 }, (_, i) => ({
      affiliateId: affiliate.id,
      visitorHash: `seed-visitor-${i}`,
      landingPath: pick(["/", "/products/nimbus-nextjs-saas-starter", "/products/fooddash-flutter-food-delivery", "/pricing"]),
      referrer: pick(["https://ayesha.dev/blog/best-nextjs-templates", "https://twitter.com", "https://youtube.com"]),
      createdAt: daysAgo(Math.floor(random() * 120)),
    })),
  });

  // Credit some existing demo orders bought by other demo buyers
  const orders = await prisma.orderInvoice.findMany({
    where: { orderNumber: { startsWith: SEED_ORDER_PREFIX }, status: "COMPLETED", NOT: { userId: user.id } },
    orderBy: { createdAt: "asc" },
    take: 14,
    select: { id: true, totalAmount: true, createdAt: true },
  });
  const paidOut = orders.slice(0, 6);
  const payout = await prisma.affiliatePayout.create({
    data: {
      affiliateId: affiliate.id,
      amount: Math.round(paidOut.reduce((sum, order) => sum + order.totalAmount * 0.2, 0) * 100) / 100,
      method: "bkash",
      details: "01700000000",
      status: "PAID",
      reference: "bKash TX DEMO8N7A6K",
      paidAt: daysAgo(20),
    },
  });
  for (const [index, order] of orders.entries()) {
    const status = index < 6 ? "PAID" : index < 11 ? "APPROVED" : "PENDING";
    await prisma.orderInvoice.update({ where: { id: order.id }, data: { affiliateId: affiliate.id } });
    await prisma.referral.create({
      data: {
        affiliateId: affiliate.id,
        orderId: order.id,
        orderAmount: order.totalAmount,
        commission: Math.round(order.totalAmount * 20) / 100,
        status,
        approvableAt: status === "PENDING" ? daysAgo(-10) : new Date(order.createdAt.getTime() + 14 * 86_400_000),
        payoutId: status === "PAID" ? payout.id : null,
      },
    });
  }
  console.log(`🤝 Demo affiliate AYESHA20 with 180 clicks and ${orders.length} commissions`);
}

// 60 days of daily views/sales so the analytics dashboards have history
async function seedAnalytics() {
  const products = await prisma.template.findMany({
    where: { slug: { in: seedProducts.map((p) => p.slug) } },
    select: { id: true, viewCount: true, price: true, salePrice: true },
  });
  if ((await prisma.productDailyStat.count({ where: { productId: { in: products.map((p) => p.id) } } })) > 0) return;
  const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  const rows = products.flatMap((product) =>
    Array.from({ length: 60 }, (_, i) => {
      const views = Math.round((product.viewCount / 240) * (0.5 + random()));
      const sales = random() < 0.35 ? 1 + Math.floor(random() * 2) : 0;
      return {
        productId: product.id,
        date: new Date(today.getTime() - i * 86_400_000),
        views,
        sales,
        revenue: Math.round(sales * (product.salePrice ?? product.price) * 100) / 100,
      };
    })
  );
  await prisma.productDailyStat.createMany({ data: rows });
  console.log(`📈 Created ${rows.length} daily analytics rows`);
}

async function seedTickets() {
  const buyer = await prisma.user.findUnique({ where: { email: `daniel.okafor@${DEMO_DOMAIN}` }, select: { id: true } });
  const product = await prisma.template.findUnique({ where: { slug: "nimbus-nextjs-saas-starter" }, select: { id: true } });
  const agent = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!buyer || !product || !agent || (await prisma.supportTicket.count({ where: { userId: buyer.id } })) > 0) return;
  await prisma.supportTicket.create({
    data: {
      userId: buyer.id,
      productId: product.id,
      subject: "Stripe webhook not firing locally",
      status: "AWAITING_CUSTOMER",
      assignedToId: agent.id,
      messages: {
        create: [
          { authorId: buyer.id, body: "Checkout works but the subscription never activates on my machine. Am I missing a step?", createdAt: daysAgo(2) },
          { authorId: agent.id, isStaff: true, body: "Run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and copy the printed secret into STRIPE_WEBHOOK_SECRET.", createdAt: daysAgo(1) },
        ],
      },
    },
  });
  await prisma.supportTicket.create({
    data: {
      userId: buyer.id,
      subject: "Invoice with company details",
      priority: "LOW",
      messages: { create: [{ authorId: buyer.id, body: "Could you add my company name and VAT number to my last invoice?" }] },
    },
  });
  console.log("🎫 Created 2 demo support tickets");
}

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  console.log(`🎯 Target: ${url.hostname} (schema: ${url.searchParams.get("schema") ?? "public"})`);
  const startedAt = Date.now();

  if (process.argv.includes("--clean")) {
    await clean();
  } else {
    await seedCatalog();
    const users = await seedBuyers();
    await seedOrdersAndReviews(users);
    await seedCommerce();
    await seedVersions();
    await seedAffiliate();
    await seedAnalytics();
    await seedTickets();
    await seedDemoAccounts(prisma);
    console.log("✅ Marketplace seed complete");
  }
  console.log(`⏱  ${Math.round((Date.now() - startedAt) / 1000)}s`);
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
