/**
 * POST /api/sync/products
 * Triggers WooCommerce product sync
 * Returns immediately with sync status
 */

import { NextResponse } from 'next/server';
import { syncWooCommerceProducts } from '@/lib/sync-service';
import { requireRole } from '@/lib/session';

export async function POST() {
  try {
    // 🔒 Only authenticated cashiers and admins can trigger a sync
    await requireRole(["ADMIN", "CASHIER"]);

    console.log('[API] Product sync triggered');
    
    // Run the sync
    const result = await syncWooCommerceProducts();
    
    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error,
          message: 'Sync could not start'
        },
        { status: 409 } // Conflict
      );
    }

    // Update Zustand store with synced products
    if (result.data && result.data.length > 0) {
      // Note: We can't directly call useStore here as it's a hook
      // Instead, we'll return the data and let the client update the store
      console.log(`[API] Sync completed. ${result.data.length} products synced.`);
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      syncId: result.syncId,
      duration: result.duration,
      message: `Successfully synced ${result.data?.length || 0} products`
    });

  } catch (error: any) {
    console.error('[API] Product sync error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
        message: 'Sync failed unexpectedly'
      },
      { status: 500 }
    );
  }
}

// Prevent caching
export const dynamic = 'force-dynamic';
