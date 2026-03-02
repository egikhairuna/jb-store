import api from "@/lib/woocommerce";
import { prisma } from "@/lib/prisma";
import { syncLockService } from "../sync-lock";
import { Product as LocalProduct } from "@prisma/client";

/**
 * Ultimate Product Sync Strategy
 * High Performance, Low Load, Multi-Instance Safe
 */

export async function syncWooCommerceProductsIncremental() {
  const lockResult = await syncLockService.acquireLock('products');
  
  if (!lockResult.success) {
    return { success: false, error: lockResult.message };
  }

  const { syncId } = lockResult;
  const startTime = Date.now();
  
  const log = (msg: string) => {
    console.log(`[${new Date().toLocaleTimeString()}] [IncrementalSync] [${syncId}] ${msg}`);
  };

  try {
    // 1. Get last sync time
    const syncLock = await prisma.syncLock.findUnique({ where: { id: 'products' } });
    const lastSyncedAt = syncLock?.lastSyncedAt;
    
    log(lastSyncedAt ? `Checking for updates since ${lastSyncedAt.toISOString()}` : "No previous sync found. Performing initial full sync.");

    // 2. Fetch modified products from WooCommerce
    let page = 1;
    const perPage = 100;
    let totalUpdated = 0;
    const modifiedAfter = lastSyncedAt ? lastSyncedAt.toISOString() : undefined;

    while (true) {
      log(`Fetching page ${page}...`);
      const response = await api.get("products", {
        page,
        per_page: perPage,
        status: "any",
        ...(modifiedAfter && { after: modifiedAfter })
      });

      const products = response.data || [];
      if (products.length === 0) break;

      log(`Processing ${products.length} products from page ${page}`);

      // 3. Batch upsert into local database — sequential writes (no concurrent write contention)
      for (const p of products) {
        // Fetch variants for variable products before constructing the DB record
        let variantsJson: string | null = null;
        if (p.type === 'variable') {
          try {
            const vResp = await api.get(`products/${p.id}/variations`, { per_page: 100 });
            const variants = vResp.data.map((v: any) => ({
              id: String(v.id),
              name: v.attributes.map((a: any) => a.option).join(", ") || "Default",
              price: parseFloat(v.price || "0"),
              stock: v.manage_stock ? (v.stock_quantity ?? 0) : 0,
              sku: v.sku || `WC-VAR-${v.id}`,
            }));
            variantsJson = JSON.stringify(variants);
          } catch (e) {
            log(`Warning: Failed to fetch variants for product ${p.id}`);
          }
        }

        // schema.prisma stores variants as String? (JSON-encoded) for SQLite compatibility
        const productData = {
          name: p.name as string,
          price: parseFloat(p.price || "0"),
          stock: p.manage_stock ? (p.stock_quantity ?? 0) : 999,
          sku: (p.sku || `WC-${p.id}`) as string,
          type: p.type as string,
          image: (p.images?.[0]?.src || null) as string | null,
          variants: variantsJson,
          updatedAt: new Date(),
        };

        await prisma.product.upsert({
          where: { id: String(p.id) },
          update: productData,
          create: { id: String(p.id), ...productData },
        });
        
        totalUpdated++;
      }

      if (products.length < perPage) break;
      page++;
    }

    // 4. Update lastSyncedAt
    await prisma.syncLock.update({
      where: { id: 'products' },
      data: { lastSyncedAt: new Date() }
    });

    const duration = Date.now() - startTime;
    log(`✅ Incremental sync completed. ${totalUpdated} products updated in ${(duration / 1000).toFixed(1)}s`);

    return { success: true, count: totalUpdated, duration };

  } catch (error: any) {
    log(`❌ Incremental sync failed: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    if (syncId) await syncLockService.releaseLock('products', syncId);
  }
}
