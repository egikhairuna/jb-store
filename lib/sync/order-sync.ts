import api from "@/lib/woocommerce";
import { prisma } from "@/lib/prisma";
import { syncLockService } from "../sync-lock";
import { syncConfig } from "../sync-config";
import { fetchWithExponentialBackoff } from "./sync-utils";
import { subMonths } from "date-fns";

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
        const searchResp = await fetchWithExponentialBackoff(`Idempotency check for ${order.posOrderId}`, () =>
          api.get("orders", {
            search: order.posOrderId,
            per_page: 1,
            _fields: "id,meta_data"
          })
        );

        // WooCommerce search is broad, verify metadata
        let existingOrder = (searchResp.data || []).find((o: any) => 
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
        log(`Creating record in WooCommerce for POS order ${order.posOrderId}...`);
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

        const createResp = await fetchWithExponentialBackoff(`Create order ${order.posOrderId}`, () =>
          api.post("orders", wcOrderData)
        );
        
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

/**
 * Ultimate Order Sync Strategy
 * Incremental synchronization + Safe Sliding Window Pruning
 */
export async function syncWooCommerceOrdersIncremental() {
    const lockResult = await syncLockService.acquireLock('orders');
    
    if (!lockResult.success) {
      return { success: false, error: lockResult.message };
    }
  
    const { syncId } = lockResult;
    const startTime = Date.now();
    
    const log = (msg: string) => {
      console.log(`[${new Date().toLocaleTimeString()}] [OrderSync] [${syncId}] ${msg}`);
    };
  
    try {
      log('Starting incremental order sync (Pull from WooCommerce)...');
  
      // 1. Get last sync time
      const syncLock = await prisma.syncLock.findUnique({ where: { id: 'orders' } });
      const lastSyncedAt = syncLock?.lastSyncedAt;
      
      // 2. Determine threshold for modified_after
      // If we've never synced, bootstrap with the hot window start
      const hotWindowStart = subMonths(new Date(), syncConfig.orderHotWindowMonths);
      const modifiedAfter = lastSyncedAt || hotWindowStart;
      
      log(`Checking for modified/new orders since ${modifiedAfter.toISOString()}`);
  
      // 3. Find a fallback user for online orders (mandatory per schema)
      const defaultUser = await prisma.user.findFirst({
          where: { role: 'ADMIN' },
          orderBy: { createdAt: 'asc' }
      });
  
      if (!defaultUser) {
          throw new Error("No admin user found. Please seed the database to associate online orders.");
      }
  
      // 4. Fetch modified orders from WooCommerce
      let page = 1;
      const perPage = syncConfig.wcOrderPerPage;
      let totalUpdated = 0;
      
      const orderFields = "id,date_created,date_modified,total,total_tax,discount_total,payment_method,payment_method_title,line_items,meta_data,status";
  
      while (true) {
        log(`Fetching page ${page}...`);
        
        const response = await fetchWithExponentialBackoff(`Fetch orders page ${page}`, () => 
          api.get("orders", {
            page,
            per_page: perPage,
            status: "any",
            _fields: orderFields,
            modified_after: modifiedAfter.toISOString()
          })
        );
        
        const orders = response.data || [];
        if (orders.length === 0) break;
  
        log(`Processing ${orders.length} orders from page ${page}`);
  
        for (const o of orders) {
          const posOrderId = o.meta_data?.find((m: any) => m.key === 'pos_order_id')?.value;
          const subtotal = parseFloat(o.total || "0") - parseFloat(o.total_tax || "0");
          
          const orderData = {
            wcOrderId: String(o.id),
            items: JSON.stringify(o.line_items),
            subtotal,
            discountAmount: parseFloat(o.discount_total || "0"),
            taxAmount: parseFloat(o.total_tax || "0"),
            total: parseFloat(o.total || "0"),
            paymentMethod: o.payment_method_title || o.payment_method || 'unknown',
            syncStatus: 'SYNCED',
            updatedAt: new Date(o.date_modified || o.date_created),
          };
  
          // Deduplicate: online orders use WC prefix, POS orders use their original ID
          const effectivePosOrderId = posOrderId || `WC-ONLINE-${o.id}`;
  
          await prisma.order.upsert({
            where: { posOrderId: effectivePosOrderId },
            update: orderData,
            create: { 
                posOrderId: effectivePosOrderId, 
                cashierId: defaultUser.id,
                ...orderData 
            },
          });
          
          totalUpdated++;
        }
  
        if (orders.length < perPage) break;
        page++;
      }
  
      // 5. Safe Prune (After Sync)
      const prunedCount = await pruneLocalOrders();
      log(`Safe Prune: Removed ${prunedCount} synced orders older than ${syncConfig.orderHotWindowMonths} months.`);
  
      // 6. Update lastSyncedAt
      await prisma.syncLock.upsert({
        where: { id: 'orders' },
        update: { lastSyncedAt: new Date() },
        create: { id: 'orders', isLocked: false, lastSyncedAt: new Date() }
      });
  
      const duration = Date.now() - startTime;
      log(`✅ Incremental sync completed. ${totalUpdated} orders updated in ${(duration / 1000).toFixed(1)}s`);
  
      return { success: true, count: totalUpdated, pruned: prunedCount, duration, syncId };
  
    } catch (error: any) {
      log(`❌ Incremental sync failed: ${error.message}`);
      return { success: false, error: error.message };
    } finally {
      if (syncId) await syncLockService.releaseLock('orders', syncId);
    }
  }
  
  /**
   * Safe Prune Logic
   * Deletes ONLY 'SYNCED' orders older than the sliding window.
   */
  export async function pruneLocalOrders() {
      const threshold = subMonths(new Date(), syncConfig.orderHotWindowMonths);
      const result = await prisma.order.deleteMany({
          where: {
              syncStatus: 'SYNCED',
              createdAt: {
                  lt: threshold
              }
          }
      });
      return result.count;
  }
