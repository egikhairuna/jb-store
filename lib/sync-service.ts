/**
 * Centralized WooCommerce Sync Service
 * Handles all heavy WooCommerce API operations
 * Never called directly from client components
 */

import api from "@/lib/woocommerce";
import { Product, Order } from "@/lib/store";
import { syncLockService } from "./sync-lock";
import { syncConfig } from "./sync-config";
import { syncWooCommerceProductsIncremental } from "./sync/product-sync";
import { prisma } from "./prisma";
import { fetchWithExponentialBackoff } from "./sync/sync-utils";

interface SyncResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  syncId?: string;
  duration?: number;
}

/**
 * Sync products from WooCommerce
 * REDIRECTED: Now runs the optimized incremental sync and returns data from local SQLite DB.
 * This preserves the API contract for the frontend while eliminating 400-600% CPU spikes.
 */
export async function syncWooCommerceProducts(): Promise<SyncResult<Product[]>> {
  const startTime = Date.now();
  
  try {
    console.log(`[${new Date().toLocaleTimeString()}] [SyncService] Starting redirected product sync...`);
    
    // 1. Trigger the hardened incremental sync
    const syncResult = await syncWooCommerceProductsIncremental();
    
    if (!syncResult.success) {
      return {
        success: false,
        error: syncResult.error,
        duration: Date.now() - startTime
      };
    }

    // 2. Fetch all products from local SQLite to return to the client
    // This satisfies the API contract of Returning the full product list for store hydration
    const dbProducts = await prisma.product.findMany({
      orderBy: { id: 'desc' }
    });

    const mappedProducts: Product[] = dbProducts.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      stock: p.stock,
      sku: p.sku || `WC-${p.id}`,
      type: p.type === 'variable' ? 'variable' : 'simple',
      image: p.image || undefined,
      variants: p.variants ? JSON.parse(p.variants) : [],
    }));

    const duration = Date.now() - startTime;
    console.log(`[SyncService] ✅ Redirected sync success. Served ${mappedProducts.length} items from DB in ${(duration / 1000).toFixed(1)}s`);

    return {
      success: true,
      data: mappedProducts,
      duration,
      syncId: syncResult.syncId
    };

  } catch (error: any) {
    console.error(`[SyncService] ❌ Redirected sync failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

import { syncWooCommerceOrdersIncremental } from "./sync/order-sync";

// ... [existing code] ...

/**
 * Sync orders from WooCommerce
 * REDIRECTED: Now runs incremental sync and returns data from local SQLite DB.
 */
export async function syncWooCommerceOrders(
  page: number = 1,
  perPage: number = 50,
  status: string = 'completed',
  after?: string
): Promise<SyncResult<Order[]>> {
  const startTime = Date.now();
  
  try {
    console.log(`[OrderSyncService] Starting redirected order sync...`);
    
    // 1. Trigger the incremental sync + prune
    const syncResult = await syncWooCommerceOrdersIncremental();
    
    if (!syncResult.success) {
      return {
        success: false,
        error: syncResult.error,
        duration: Date.now() - startTime
      };
    }

    // 2. Fetch recent orders from local SQLite to return to the client
    // We return 'hot' data (recent 100) to refresh the UI view
    const dbOrders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    const mappedOrders: Order[] = dbOrders.map(o => ({
      id: o.wcOrderId || o.posOrderId,
      date: o.createdAt.toISOString(),
      items: JSON.parse(o.items),
      total: o.total,
      subtotal: o.subtotal,
      tax: o.taxAmount,
      discount: o.discountAmount,
      paymentMethod: o.paymentMethod,
      cashAmount: o.cashAmount || undefined,
      transferAmount: o.transferAmount || undefined,
      isPosOrder: true, // If it's in our DB, we treat it for UI purposes as POS-available
      posOrderId: o.posOrderId
    }));

    const duration = Date.now() - startTime;
    console.log(`[OrderSyncService] ✅ Redirected sync success. Served ${mappedOrders.length} items from DB.`);

    return {
      success: true,
      data: mappedOrders,
      duration,
      syncId: syncResult.syncId
    };

  } catch (error: any) {
    console.error(`[OrderSyncService] ❌ Failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}
