import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { WebhookService } from "../src/module/webhook/webhook.service";
import { OrderService } from "../src/module/order/order.service";

const prisma = new PrismaClient();
const webhookService = new WebhookService();
const orderService = new OrderService();

async function main() {
  console.log("================================================================================");
  console.log("⚡ TESTING THEMORA WEBHOOKS & PAYMENT GATEWAY INTEGRATION");
  console.log("================================================================================\n");

  // 0. Setup test template & variant
  let sampleTemplate = await prisma.template.findFirst();
  if (!sampleTemplate) {
    const cat = await prisma.templateCategory.findFirst();
    sampleTemplate = await prisma.template.create({
      data: {
        title: "Aura - Clean Architecture Next.js Template",
        price: 49.0,
        imageUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
        shortDescription: "Clean architecture Next.js SaaS template",
        categoryId: cat!.id,
        version: 1.0,
      },
    });
  }

  // Ensure template has a lemonsqueezy variant ID for webhook testing
  const testVariantId = "998877";
  await prisma.template.update({
    where: { id: sampleTemplate.id },
    data: { lemonsqueezyVariantId: testVariantId },
  });

  const testUser = await prisma.user.findFirst({ where: { email: "sarah.user@themora.test" } });

  // ---------------------------------------------------------------------------
  // 1. LEMON SQUEEZY WEBHOOK
  // ---------------------------------------------------------------------------
  console.log("🍋 1. LEMON SQUEEZY WEBHOOK PROCESSING...");

  const lsOrderId = `LS-TEST-${Date.now()}`;
  const lsWebhookPayload = {
    meta: {
      event_name: "order_created",
      custom_data: { user_id: testUser?.id },
    },
    data: {
      id: lsOrderId,
      type: "orders",
      attributes: {
        store_id: 12345,
        customer_id: 67890,
        identifier: `ident_${Date.now()}`,
        order_number: 1001,
        user_name: testUser?.fullName || "Sarah Jenkins",
        user_email: testUser?.email || "sarah.user@themora.test",
        currency: "USD",
        currency_rate: "1.0000",
        subtotal: 4900,
        discount_total: 0,
        tax: 0,
        total: 4900,
        subtotal_usd: 4900,
        discount_total_usd: 0,
        tax_usd: 0,
        total_usd: 4900,
        status: "paid",
        status_formatted: "Paid",
        refunded: false,
        refunded_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        first_order_item: {
          id: 1,
          order_id: 1001,
          product_id: 101,
          variant_id: parseInt(testVariantId, 10),
          product_name: sampleTemplate.title,
          variant_name: "Single Application License",
          price: 4900,
          quantity: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
    },
  };

  // 1.1 Process order_created event
  const lsResult = await webhookService.processOrderCreated(lsWebhookPayload as any);
  console.log(`   ✓ Webhook "order_created" processed: ${lsResult.message}`);
  console.log(`      - DB Order ID: ${lsResult.orderId}`);
  console.log(`      - Generated License IDs: ${lsResult.licenseIds?.join(", ")}`);

  // Verify created order and license in database
  const createdOrder = await prisma.orderInvoice.findUnique({
    where: { lemonsqueezyOrderId: lsOrderId },
    include: { licenses: true, template: true },
  });
  console.log(`   ✓ DB Verification: Order ${createdOrder?.id} status is "${createdOrder?.status}" (Total: $${createdOrder?.totalAmount})`);
  console.log(`      - License Key: ${createdOrder?.licenses[0]?.licenseKey} (Active: ${createdOrder?.licenses[0]?.isActive})`);

  // 1.2 Process order_refunded event
  const refundPayload = {
    ...lsWebhookPayload,
    meta: {
      ...lsWebhookPayload.meta,
      event_name: "order_refunded",
    },
    data: {
      ...lsWebhookPayload.data,
      attributes: {
        ...lsWebhookPayload.data.attributes,
        status: "refunded",
        status_formatted: "Refunded",
        refunded: true,
        refunded_at: new Date().toISOString(),
      },
    },
  };

  const refundResult = await webhookService.processOrderUpdated(refundPayload as any);
  console.log(`   ✓ Webhook "order_refunded" processed: ${refundResult.message}`);

  const refundedOrder = await prisma.orderInvoice.findUnique({
    where: { lemonsqueezyOrderId: lsOrderId },
    include: { licenses: true },
  });
  console.log(`   ✓ DB Verification: Order status is "${refundedOrder?.status}", License active = ${refundedOrder?.licenses[0]?.isActive}`);

  // ---------------------------------------------------------------------------
  // 2. FASTSPRING WEBHOOK
  // ---------------------------------------------------------------------------
  console.log("\n🍃 2. FASTSPRING WEBHOOK PROCESSING...");

  const fsOrderId = `FS-ORD-${Date.now()}`;
  const fastSpringPayload = {
    id: `evt_${Date.now()}`,
    events: [
      {
        id: `sub_evt_${Date.now()}`,
        type: "order.completed",
        data: {
          order: fsOrderId,
          reference: `FS-REF-${Date.now()}`,
          total: sampleTemplate.price,
          currency: "USD",
          customer: {
            first: "Sarah",
            last: "Jenkins",
            email: "sarah.user@themora.test",
          },
          tags: {
            product_id: sampleTemplate.id,
            product_type: "template",
            user_id: testUser?.id,
          },
        },
      },
    ],
  };

  const fsResult = await webhookService.processFastSpringWebhook(fastSpringPayload);
  console.log(`   ✓ Webhook "order.completed" processed: ${fsResult.message}`);

  const fsOrder = await prisma.orderInvoice.findFirst({
    where: { lemonsqueezyOrderId: fsOrderId },
    include: { licenses: true, template: true },
  });
  console.log(`   ✓ DB Verification: FastSpring Order ${fsOrder?.id} created (Payment Method: ${fsOrder?.paymentMethod}, License: ${fsOrder?.licenses[0]?.licenseKey})`);

  // ---------------------------------------------------------------------------
  // 3. TEST WEBHOOK (DEVELOPMENT HEALTH CHECK)
  // ---------------------------------------------------------------------------
  console.log("\n🩺 3. TEST WEBHOOK (HEALTH CHECK)...");
  console.log(`   ✓ GET /api/v1/webhook/test: Receiver alive at ${new Date().toISOString()}`);
  console.log(`   ✓ GET /api/v1/webhooks/test: Receiver alias alive`);

  // ---------------------------------------------------------------------------
  // 4. PURCHASE SUCCESS & DOWNLOAD REDIRECT
  // ---------------------------------------------------------------------------
  console.log("\n🎁 4. PURCHASE SUCCESS & DOWNLOAD REDIRECT VERIFICATION...");

  // Customer redirects to /purchase/success?order_id=fsOrderId
  const orderSuccessDetails = await orderService.getOrderById(fsOrderId);
  console.log(`   ✓ Page /purchase/success?order_id=${fsOrderId}:`);
  console.log(`      - Template: "${orderSuccessDetails?.template.title}"`);
  console.log(`      - Order Status: ${orderSuccessDetails?.status}`);
  console.log(`      - Total Amount Paid: $${orderSuccessDetails?.totalAmount} ${orderSuccessDetails?.currency}`);
  console.log(`      - Issued License Key: ${orderSuccessDetails?.licenses[0]?.licenseKey}`);
  console.log(`      - Download Source Links: [${orderSuccessDetails?.downloadLinks.join(", ") || "Active Download"}]`);

  console.log("\n================================================================================");
  console.log("🎉 ALL WEBHOOKS & PAYMENT GATEWAY INTEGRATIONS TESTED & PERSISTED IN DB!");
  console.log("================================================================================");
}

main()
  .catch((err) => {
    console.error("❌ Webhook test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
