import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * WooCommerce Webhook Listener
 * High Integrity, Real-Time Sync
 */

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const signature = req.headers.get("x-wc-webhook-signature");
    const topic = req.headers.get("x-wc-webhook-topic");
    const secret = process.env.WC_WEBHOOK_SECRET;

    if (!secret) {
        console.error("[Webhook] WC_WEBHOOK_SECRET not configured.");
        return NextResponse.json({ error: "Configuration missing" }, { status: 500 });
    }

    // 1. Validate Signature
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(bodyText)
      .digest("base64");

    if (signature !== expectedSignature) {
      console.warn("[Webhook] Invalid signature received.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(bodyText);
    const productId = String(payload.id);

    console.log(`[Webhook] Received ${topic} for product ${productId}`);

    // 2. Handle Topics
    if (topic === "product.updated" || topic === "product.created") {
      console.log(`[Webhook] Product ${topic} received for #${productId}`);
      // Product sync is handled by manual sync and background workers to ensure 
      // complex variations are correctly mapped through the SyncService.
    } 
    else if (topic === "product.deleted") {
      console.log(`[Webhook] Product deletion received for #${productId}`);
    }
    else if (topic === "order.updated" || topic === "order.created") {
        console.log(`[Webhook] Order ${topic} received for #${payload.id}`);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("[Webhook] Error processing webhook:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
