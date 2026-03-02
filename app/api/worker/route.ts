import { NextResponse } from "next/server";
import { retryFailedOrders } from "@/lib/sync/order-sync";
import { syncWooCommerceProductsIncremental } from "@/lib/sync/product-sync";
import { syncLockService } from "@/lib/sync-lock";

/**
 * POS Background Worker
 * Orchestrates periodic tasks
 * Secured by WORKER_KEY to prevent public abuse
 */

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");

    if (key !== process.env.WORKER_KEY) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const mode = searchParams.get("mode") || "all";
    const results: any = {};

    console.log(`[Worker] Started mode: ${mode}`);

    if (mode === "orders" || mode === "all") {
        results.orders = await retryFailedOrders();
    }

    if (mode === "products" || mode === "all") {
        results.products = await syncWooCommerceProductsIncremental();
    }

    return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        results
    });

  } catch (error: any) {
    console.error("[Worker] Fatal error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
