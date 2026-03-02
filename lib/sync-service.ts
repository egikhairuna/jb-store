/**
 * Centralized WooCommerce Sync Service
 * Handles all heavy WooCommerce API operations
 * Never called directly from client components
 */

import api from "@/lib/woocommerce";
import { Product, Order } from "@/lib/store";
import { syncLockService } from "./sync-lock";

interface SyncResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  syncId?: string;
  duration?: number;
}

/**
 * Sync products from WooCommerce
 * This is a heavy, long-running operation
 */
export async function syncWooCommerceProducts(): Promise<SyncResult<Product[]>> {
  const lockResult = await syncLockService.acquireLock('products');
  
  if (!lockResult.success) {
    return {
      success: false,
      error: lockResult.message
    };
  }

  const { syncId } = lockResult;
  const startTime = Date.now();
  
  const log = (msg: string) => {
    console.log(`[${new Date().toLocaleTimeString()}] [ProductSync] [${syncId}] ${msg}`);
  };

  try {
    log('Starting product sync...');
    
    // Helper function for retry logic
    const fetchWithRetry = async (fn: () => Promise<any>, retries = 3): Promise<any> => {
      try {
        return await fn();
      } catch (error: any) {
        if (retries === 0) throw error;
        log(`Retry failed, ${retries} attempts remaining...`);
        await new Promise(resolve => setTimeout(resolve, 500));
        return fetchWithRetry(fn, retries - 1);
      }
    };
    
    // Fetch all products with pagination - DETERMINISTIC
    let page = 1;
    const perPage = 100;
    let allProducts: any[] = [];

    while (true) {
      const response = await fetchWithRetry(() => 
        api.get("products", {
          page,
          per_page: perPage,
          status: "any", // ✅ FETCH ALL STATUSES (publish, draft, private, pending)
        })
      );

      const fetchedCount = response.data?.length || 0;
      log(`Page ${page} → ${fetchedCount} products`);

      // Stop only when response is empty
      if (!response.data || response.data.length === 0) {
        break;
      }

      allProducts.push(...response.data);
      page++;
    }

    log(`Total fetched: ${allProducts.length} products`);

    // Process in batches
    const BATCH_SIZE = 10;
    const mappedProducts: Product[] = [];

    for (let i = 0; i < allProducts.length; i += BATCH_SIZE) {
      const batch = allProducts.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allProducts.length / BATCH_SIZE);
      
      log(`Processing batch ${batchNum}/${totalBatches}...`);
      
      const batchResults = await Promise.all(batch.map(async (p: any) => {
        const product: Product = {
          id: String(p.id),
          name: p.name,
          price: p.price ? parseFloat(p.price) : 0,
          stock: p.manage_stock ? (p.stock_quantity ?? 0) : 100,
          sku: p.sku || `WC-${p.id}`,
          type: p.type === 'variable' ? 'variable' : 'simple',
          image: p.images && p.images.length > 0 ? p.images[0].src : undefined,
          variants: [],
        };

        if (product.type === 'variable') {
          try {
            const variantsResponse = await fetchWithRetry(() =>
              api.get(`products/${product.id}/variations`, {
                per_page: 50
              })
            );
            
            product.variants = variantsResponse.data.map((v: any) => ({
              id: String(v.id),
              name: v.attributes.map((a: any) => a.option).join(", ") || "Variant",
              price: v.price ? parseFloat(v.price) : 0,
              stock: v.manage_stock ? (v.stock_quantity ?? 0) : 0,
              sku: v.sku || `WC-VAR-${v.id}`
            }));
          } catch (error: any) {
            log(`Warning: Failed to fetch variants for product ${product.id}: ${error.message}`);
          }
        }

        return product;
      }));

      mappedProducts.push(...batchResults);
      
      // Small delay between batches
      if (i + BATCH_SIZE < allProducts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const duration = Date.now() - startTime;
    
    // ✅ HARD VALIDATION: Fail loudly if incomplete
    if (mappedProducts.length !== allProducts.length) {
      const errorMsg = `INCOMPLETE SYNC: Fetched ${allProducts.length} products but only processed ${mappedProducts.length}`;
      log(`ERROR: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    log(`✅ Sync completed successfully. ${mappedProducts.length} products processed in ${(duration / 1000).toFixed(1)}s`);

    return {
      success: true,
      data: mappedProducts,
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
    if (syncId) await syncLockService.releaseLock('products', syncId);
  }
}

/**
 * Sync orders from WooCommerce
 */
export async function syncWooCommerceOrders(
  page: number = 1,
  perPage: number = 100,
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
  
  const log = (msg: string) => {
    console.log(`[${new Date().toLocaleTimeString()}] [OrderSync] [${syncId}] ${msg}`);
  };

  try {
    log(`Fetching orders (page ${page}, status: ${status}, after: ${after || 'initial'})...`);
    
    const params: any = {
      per_page: perPage,
      page,
      status,
    };

    if (after) {
      params.after = after;
    }

    const response = await api.get("orders", params);

    const orders: Order[] = response.data.map((order: any) => ({
      id: String(order.id),
      date: order.date_created,
      items: order.line_items.map((item: any) => ({
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
      total: parseFloat(order.total),
      subtotal: parseFloat(order.total) - parseFloat(order.total_tax),
      tax: parseFloat(order.total_tax),
      discount: parseFloat(order.discount_total),
      paymentMethod: order.payment_method_title,
      isPosOrder: order.meta_data.some((m: any) => m.key === 'pos_order_id'),
      posOrderId: order.meta_data.find((m: any) => m.key === 'pos_order_id')?.value
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
