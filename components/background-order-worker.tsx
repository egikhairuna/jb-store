"use client"

import { useEffect, useState, useRef } from "react"
import { useStore } from "@/lib/store"
import { useSession } from "next-auth/react"

/**
 * Background Order Worker
 * Automatically polls WooCommerce for new orders using incremental sync.
 * This is production-safe: it only fetches deltas and uses locks.
 */
export function BackgroundOrderWorker() {
  const { status } = useSession()
  const { wcOrders, setWCOrders } = useStore()
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  const isInitialSyncDone = useRef(false)
  
  // Set initial sync time to 1 hour ago on first mount
  useEffect(() => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    setLastSyncTime(oneHourAgo)
  }, [])

  useEffect(() => {
    // Only workers while authenticated and not already syncing
    if (status !== "authenticated") return

    const pollInterval = 5 * 60 * 1000 // 5 minutes (Conservative)
    
    const performSync = async () => {
        try {
            console.log(`[Worker] Starting incremental order sync (After: ${lastSyncTime})...`)
            
            const params = new URLSearchParams()
            params.set('status', 'completed')
            if (lastSyncTime) {
                params.set('after', lastSyncTime)
            }

            const response = await fetch(`/api/sync/orders?${params.toString()}`, {
                method: 'POST',
            })

            if (!response.ok) {
                // If 409, it's just locked, we try again next interval
                if (response.status === 409) {
                    console.log("[Worker] Sync is currently locked by another process.")
                }
                return
            }

            const json = await response.json()
            if (json.success && json.data) {
                const fetchedOrders = json.data
                // Double-guard: only include completed orders in the local state
                const newOrders = fetchedOrders.filter((o: any) => o.status === 'completed')
                
                if (newOrders.length > 0 || fetchedOrders.length > 0) {
                    console.log(`[Worker] Found ${newOrders.length} new/updated orders.`)
                    
                    // Merge new orders into existing list (deduplicate by ID)
                    setWCOrders((prev: any[]) => {
                        const existingIds = new Set(prev.map(o => o.id))
                        const filteredNew = newOrders.filter((no: any) => !existingIds.has(no.id))
                        
                        // Also update existing if they are in the 'new' list (for status updates)
                        const updatedList = prev.map(eo => {
                            const update = newOrders.find((no: any) => no.id === eo.id)
                            return update || eo
                        })

                        return [...updatedList, ...filteredNew].sort((a, b) => 
                            new Date(b.date).getTime() - new Date(a.date).getTime()
                        )
                    })
                }

                // Update last sync time to now
                setLastSyncTime(new Date().toISOString())
                isInitialSyncDone.current = true
            }
        } catch (error) {
            console.error("[Worker] Incremental sync failed:", error)
        }
    }

    // Run immediately on mount if not done
    if (!isInitialSyncDone.current) {
        performSync()
    }

    const timer = setInterval(performSync, pollInterval)
    return () => clearInterval(timer)
  }, [status, lastSyncTime, setWCOrders])

  return null // Headless worker
}
