"use client"

import { useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useStore } from "@/lib/store"

/**
 * Automically triggers a full sync (products + orders) 
 * when a user logs in (or refreshes the page while logged in).
 * This ensures the device always has fresh data from WooCommerce.
 */
export function SyncOnLogin() {
  const { data: session, status } = useSession()
  const hasSynced = useRef(false)
  const setProducts = useStore((state) => state.setProducts)
  const setOrders = useStore((state) => state.setOrders)

  useEffect(() => {
    // Only trigger if authenticated and we haven't synced in this mount cycle
    if (status === 'authenticated' && !hasSynced.current) {
      const performSync = async () => {
        hasSynced.current = true
        console.log("[SyncOnLogin] Starting auto-sync on login...");
        
        try {
          // 1. Sync Products
          const productsRes = await fetch('/api/sync/products', { method: 'POST' })
          const productsData = await productsRes.json()
          if (productsData.success && productsData.data) {
            setProducts(productsData.data)
          }

          // 2. Sync Orders (Triggers Server-Side Incremental Sync)
          await fetch('/api/sync/orders', { method: 'POST' })
          
          // 3. Refresh Local DB Orders (This pulls the latest synced/local data)
          const ordersRes = await fetch('/api/orders')
          const ordersData = await ordersRes.json()
          
          if (ordersData.success && ordersData.data) {
            const mappedOrders = ordersData.data.map((o: any) => {
              const isPOS = o.posOrderId && o.posOrderId.startsWith('POS-');
              const source = isPOS ? 'POS' : 'WooCommerce';
              const cashierName = source === 'WooCommerce' ? null : (o.cashier?.name || o.cashier?.email || 'Staff');
              
              return {
                id: o.wcOrderId || o.posOrderId, // Prioritize WC ID for display
                posOrderId: o.posOrderId,
                dbId: o.id,
                date: o.createdAt,
                items: o.items,
                total: o.total,
                subtotal: o.subtotal,
                tax: o.taxAmount,
                discount: o.discountAmount,
                paymentMethod: o.paymentMethod,
                cashAmount: o.cashAmount,
                transferAmount: o.transferAmount,
                syncStatus: o.syncStatus.toLowerCase(),
                cashierName,
                source
              }
            })
            setOrders(mappedOrders)
          }
          console.log("[SyncOnLogin] Auto-sync complete.");
        } catch (error) {
          console.error("[SyncOnLogin] Auto-sync failed:", error)
          // We don't reset hasSynced.current here to avoid infinite retry loops 
          // if there are persistent network/server issues. 
          // The user can still manual sync via the Sidebar.
        }
      }
      
      performSync()
    }
    
    // Reset sync flag if user logs out (so it re-syncs on next login)
    if (status === 'unauthenticated') {
        hasSynced.current = false
    }
  }, [status, setProducts, setOrders])

  return null
}
