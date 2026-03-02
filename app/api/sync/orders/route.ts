/**
 * POST /api/sync/orders
 * Triggers WooCommerce order sync
 */

import { NextResponse } from 'next/server';
import { syncWooCommerceOrders } from '@/lib/sync-service';
import { requireRole } from '@/lib/session';

export async function POST(request: Request) {
  try {
    // 🔒 Only authenticated cashiers and admins can trigger an order sync
    await requireRole(["ADMIN", "CASHIER"]);
    // Parse optional query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('per_page') || '100');
    const status = searchParams.get('status') || 'completed';
    const after = searchParams.get('after') || undefined;

    console.log(`[API] Order sync triggered (page: ${page}, status: ${status}, after: ${after})`);
    
    const result = await syncWooCommerceOrders(page, perPage, status, after);
    
    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error,
          message: 'Sync could not start'
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      syncId: result.syncId,
      duration: result.duration,
      message: `Successfully synced ${result.data?.length || 0} orders`
    });

  } catch (error: any) {
    console.error('[API] Order sync error:', error);
    
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

export const dynamic = 'force-dynamic';
