/**
 * Seeds the marketplace with realistic demo data: categories, ~30 products,
 * demo buyers, completed orders and reviews. Safe to run repeatedly (upserts).
 *
 *   npm run seed:marketplace           # create or refresh demo data
 *   npm run seed:marketplace -- --clean  # remove all demo data again
 *
 * Every demo record is identifiable: buyers use @demo.themora.dev emails,
 * orders use a "seed_" order ID, and products are listed in seed-data/catalog.ts.
 * Run --clean before real customers use the store.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { LicenseType, Prisma, PrismaClient } from "@prisma/client";
import {
  baseCategories,
  existingProductEnrichment,
  seedCategories,
  seedProducts,
  whatsIncludedByType,
} from "./seed-data/catalog";
import { reviewPool } from "./seed-data/reviews";

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
  const orders = await prisma.orderInvoice.deleteMany({ where: { lemonsqueezyOrderId: { startsWith: SEED_ORDER_PREFIX } } });
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
    select: { id: true, slug: true, price: true, salePrice: true, isFree: true },
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
          await prisma.orderInvoice.upsert({
            where: { lemonsqueezyOrderId: plan.orderId },
            create: {
              lemonsqueezyOrderId: plan.orderId,
              userId: plan.user.id,
              templateId: product.id,
              status: "COMPLETED",
              totalAmount: product.salePrice ?? product.price,
              currency: "USD",
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
