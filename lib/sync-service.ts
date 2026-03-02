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
      orderBy: { name: 'asc' }
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

/**
 * Sync orders from WooCommerce
 * HARDENED: Added _fields filtering and capped perPage to reduce load.
 */
export async function syncWooCommerceOrders(
  page: number = 1,
  perPage: number = 50,
  status: string = 'completed',
  after?: string
): Promise<SyncResult<Order[]>> {
  const lockResult = await syncLockService.acquireLock('orders');
  
  if (!lockResult.success) {
    return {
      success: false,
      error: lockResult.message
    };
  }

  const { syncId } = lockResult;
  const startTime = Date.now();
  const finalPerPage = Math.min(perPage, syncConfig.wcOrderPerPage);
  
  const log = (msg: string) => {
    console.log(`[${new Date().toLocaleTimeString()}] [OrderSync] [${syncId}] ${msg}`);
  };

  try {
    log(`Fetching orders (page ${page}, per_page: ${finalPerPage}, status: ${status}, after: ${after || 'initial'})...`);
    
    const params: any = {
      per_page: finalPerPage,
      page,
      status,
      _fields: "id,date_created,total,total_tax,discount_total,payment_method_title,line_items,meta_data,status"
    };

    if (after) {
      params.after = after;
    }

    const response = await fetchWithExponentialBackoff(`Fetch orders page ${page}`, () => 
      api.get("orders", params)
    );

    const orders: Order[] = (response.data || []).map((order: any) => ({
      id: String(order.id),
      date: order.date_created,
      items: (order.line_items || []).map((item: any) => ({
        id: String(item.product_id),
        name: item.name,
        price: item.price ? parseFloat(item.price) : 0,
        quantity: item.quantity,
        sku: item.sku || '',
        type: item.variation_id ? 'variable' : 'simple',
        stock: 0,
        variantId: item.variation_id ? String(item.variation_id) : undefined,
        variantName: item.meta_data?.find((m: any) => m.key === 'pa_color' || m.key === 'pa_size')?.value || '',
      })),
      total: parseFloat(order.total || "0"),
      subtotal: parseFloat(order.total || "0") - parseFloat(order.total_tax || "0"),
      tax: parseFloat(order.total_tax || "0"),
      discount: parseFloat(order.discount_total || "0"),
      paymentMethod: order.payment_method_title,
      isPosOrder: order.meta_data?.some((m: any) => m.key === 'pos_order_id'),
      posOrderId: order.meta_data?.find((m: any) => m.key === 'pos_order_id')?.value
    }));

    const duration = Date.now() - startTime;
    log(`Fetched ${orders.length} orders in ${(duration / 1000).toFixed(1)}s`);

    return {
      success: true,
      data: orders,
      syncId,
      duration
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    log(`Sync failed after ${(duration / 1000).toFixed(1)}s: ${error.message}`);
    
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
      syncId,
      duration
    };
  } finally {
    if (syncId) await syncLockService.releaseLock('orders', syncId);
  }
}
