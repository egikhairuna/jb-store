"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, XCircle, Loader2 } from "lucide-react";

/**
 * Manual Sync Component
 * User explicitly triggers WooCommerce sync
 * Never blocks UI or runs automatically
 */
export function SyncManager() {
  const setProducts = useStore((state) => state.setProducts);
  const setWCOrders = useStore((state) => state.setWCOrders);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleSyncProducts = async () => {
    setIsSyncing(true);
    setSyncStatus('idle');
    setErrorMessage('');

    try {
      const response = await fetch('/api/sync/products', {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success && result.data) {
        // Update Zustand store with synced products
        setProducts(result.data);
        setSyncStatus('success');
        setLastSyncTime(new Date());
        console.log(`[SyncManager] Products synced: ${result.data.length} items`);
      } else {
        setSyncStatus('error');
        setErrorMessage(result.error || 'Sync failed');
        console.error('[SyncManager] Sync failed:', result.error);
      }
    } catch (error: any) {
      setSyncStatus('error');
      setErrorMessage(error.message || 'Network error');
      console.error('[SyncManager] Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncOrders = async () => {
    setIsSyncing(true);
    setSyncStatus('idle');
    setErrorMessage('');

    try {
      const response = await fetch('/api/sync/orders', {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success && result.data) {
        setWCOrders(result.data);
        setSyncStatus('success');
        setLastSyncTime(new Date());
        console.log(`[SyncManager] Orders synced: ${result.data.length} items`);
      } else {
        setSyncStatus('error');
        setErrorMessage(result.error || 'Sync failed');
      }
    } catch (error: any) {
      setSyncStatus('error');
      setErrorMessage(error.message || 'Network error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncAll = async () => {
    await handleSyncProducts();
    await handleSyncOrders();
  };

  return (
    <div className="fixed bottom-4 right-4 bg-card border rounded-lg shadow-lg p-4 z-50 min-w-[300px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">WooCommerce Sync</h3>
        {syncStatus === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
        {syncStatus === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
      </div>

      <div className="space-y-2">
        <Button
          onClick={handleSyncProducts}
          disabled={isSyncing}
          size="sm"
          variant="outline"
          className="w-full"
        >
          {isSyncing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync Products
        </Button>

        <Button
          onClick={handleSyncOrders}
          disabled={isSyncing}
          size="sm"
          variant="outline"
          className="w-full"
        >
          {isSyncing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync Orders
        </Button>

        <Button
          onClick={handleSyncAll}
          disabled={isSyncing}
          size="sm"
          className="w-full"
        >
          {isSyncing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync All
        </Button>
      </div>

      {errorMessage && (
        <div className="mt-3 text-xs text-red-500 bg-red-50 p-2 rounded">
          {errorMessage}
        </div>
      )}

      {lastSyncTime && (
        <div className="mt-3 text-xs text-muted-foreground">
          Last sync: {lastSyncTime.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
