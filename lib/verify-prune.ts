import { PrismaClient } from "@prisma/client";
import { subMonths, subDays } from "date-fns";

const prisma = new PrismaClient();

async function verify() {
  console.log("🧪 Starting Sync/Prune Verification...");

  // 1. Find or Create a dummy user
  let user = await prisma.user.findFirst();
  if (!user) {
    console.log("Creating dummy user...");
    user = await prisma.user.create({
      data: {
        name: "Test User",
        email: "test@example.com",
        role: "ADMIN",
        isActive: true
      }
    });
  }

  const fourMonthsAgo = subMonths(new Date(), 4);
  const oneWeekAgo = subDays(new Date(), 7);

  console.log("Inserting test orders...");

  // A. Old Synced Order (Should be pruned)
  const oldSynced = await prisma.order.upsert({
    where: { posOrderId: "TEST-OLD-SYNCED" },
    update: {},
    create: {
      posOrderId: "TEST-OLD-SYNCED",
      cashierId: user.id,
      items: "[]",
      subtotal: 100,
      total: 100,
      paymentMethod: "cash",
      syncStatus: "SYNCED",
      createdAt: fourMonthsAgo
    }
  });

  // B. New Synced Order (Should survive)
  const newSynced = await prisma.order.upsert({
    where: { posOrderId: "TEST-NEW-SYNCED" },
    update: {},
    create: {
      posOrderId: "TEST-NEW-SYNCED",
      cashierId: user.id,
      items: "[]",
      subtotal: 100,
      total: 100,
      paymentMethod: "cash",
      syncStatus: "SYNCED",
      createdAt: oneWeekAgo
    }
  });

  // C. Old Failed Order (Should survive - Safe Prune)
  const oldFailed = await prisma.order.upsert({
    where: { posOrderId: "TEST-OLD-FAILED" },
    update: {},
    create: {
      posOrderId: "TEST-OLD-FAILED",
      cashierId: user.id,
      items: "[]",
      subtotal: 100,
      total: 100,
      paymentMethod: "cash",
      syncStatus: "FAILED",
      createdAt: fourMonthsAgo
    }
  });

  console.log("Running pruneLocalOrders logic...");
  const { pruneLocalOrders } = await import("../lib/sync/order-sync");
  const prunedCount = await pruneLocalOrders();
  console.log(`Pruned count: ${prunedCount}`);

  // Verification
  const remainingIds = (await prisma.order.findMany({
    where: { posOrderId: { startsWith: "TEST-" } },
    select: { posOrderId: true }
  })).map(o => o.posOrderId);

  console.log("Remaining Test Orders:", remainingIds);

  const passed = 
    !remainingIds.includes("TEST-OLD-SYNCED") && 
    remainingIds.includes("TEST-NEW-SYNCED") && 
    remainingIds.includes("TEST-OLD-FAILED");

  if (passed) {
    console.log("✅ VERIFICATION SUCCESS: Pruning logic is safe and accurate.");
  } else {
    console.error("❌ VERIFICATION FAILED: Pruning logic behaved unexpectedly.");
  }

  // Cleanup
  await prisma.order.deleteMany({ where: { posOrderId: { startsWith: "TEST-" } } });
  await prisma.$disconnect();
}

verify().catch(console.error);
