import api from "@/lib/woocommerce";
import { prisma } from "@/lib/prisma";
import { syncLockService } from "../sync-lock";
// Note: syncStatus is a String field in schema.prisma (not an enum), so no SyncStatus import needed.

/**
 * Background Order Retry Worker
 * Ensures every POS sale eventually hits WooCommerce
 */

export async function retryFailedOrders() {
  const lockResult = await syncLockService.acquireLock('orders');
  
  if (!lockResult.success) {
    return { success: false, error: lockResult.message };
  }

  const { syncId } = lockResult;
  const startTime = Date.now();
  
  const log = (msg: string) => {
    console.log(`[${new Date().toLocaleTimeString()}] [OrderRetry] [${syncId}] ${msg}`);
  };

  try {
    // 1. Fetch failed orders
    const failedOrders = await prisma.order.findMany({
      where: { syncStatus: 'FAILED' },
      take: 20 // Process in small batches
    });

    if (failedOrders.length === 0) {
      return { success: true, count: 0 };
    }

    log(`Found ${failedOrders.length} failed orders to retry.`);

    let successCount = 0;

    for (const order of failedOrders) {
      try {
        log(`Retrying order ${order.posOrderId}...`);

        // 2. IDEMPOTENCY CHECK: Search WooCommerce first
        const searchResp = await api.get("orders", {
            search: order.posOrderId,
            per_page: 1
        });

        // WooCommerce search is broad, verify metadata
        let existingOrder = searchResp.data.find((o: any) => 
            o.meta_data.some((m: any) => m.key === 'pos_order_id' && m.value === order.posOrderId)
        );

        if (existingOrder) {
            log(`Found existing WooCommerce order #${existingOrder.id} for ${order.posOrderId}. Marking as SYNCED.`);
            await prisma.order.update({
                where: { id: order.id },
                data: { 
                    syncStatus: 'SYNCED',
                    wcOrderId: String(existingOrder.id)
                }
            });
            successCount++;
            continue;
        }

        // 3. Re-attempt Creation
        const cartItems = JSON.parse(order.items as string);
        const wcOrderData = {
            payment_method: order.paymentMethod,
            payment_method_title: order.paymentMethod.toUpperCase(),
            set_paid: true,
            line_items: cartItems.map((item: any) => ({
                product_id: parseInt(item.id),
                quantity: item.quantity,
                variation_id: item.variantId ? parseInt(item.variantId) : undefined,
            })),
            meta_data: [
                { key: "pos_order_id", value: order.posOrderId },
                { key: "sync_retry_at", value: new Date().toISOString() }
            ],
        };

        const createResp = await api.post("orders", wcOrderData);
        
        if (createResp.status === 201) {
            log(`Successfully created WooCommerce order #${createResp.data.id} for ${order.posOrderId}.`);
            await prisma.order.update({
                where: { id: order.id },
                data: { 
                    syncStatus: 'SYNCED',
                    wcOrderId: String(createResp.data.id)
                }
            });
            successCount++;
        }

      } catch (err: any) {
        log(`Failed to retry order ${order.posOrderId}: ${err.message}`);
      }
    }

    const duration = Date.now() - startTime;
    return { success: true, count: successCount, duration };

  } catch (error: any) {
    log(`❌ Order retry worker failed: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    if (syncId) await syncLockService.releaseLock('orders', syncId);
  }
}
