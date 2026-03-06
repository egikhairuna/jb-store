"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { useStore, Order, formatIDR } from "@/lib/store"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Printer, Download, Undo2, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Receipt } from "@/components/receipt"
import { PrintButton } from "@/components/print-button"
import html2canvas from "html2canvas"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getWooCommerceOrders, updateWooCommerceOrderStatus } from "@/app/actions/woocommerce"

export default function OrdersPage() {
    const { orders, wcOrders, setOrders, setWCOrders, removeOrder } = useStore()
    const [isLoading, setIsLoading] = useState(false)
    const [isDbLoading, setIsDbLoading] = useState(false)
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
    const [isReceiptOpen, setIsReceiptOpen] = useState(false)
    const receiptRef = useRef<HTMLDivElement>(null)

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)

    const fetchDBOrders = useCallback(async () => {
        setIsDbLoading(true)
        try {
            const resp = await fetch('/api/orders')
            if (resp.ok) {
                const json = await resp.json()
                if (json.success) {
                    // Match the store Order type mapping if needed
                    const dbOrders = json.data.map((o: any) => {
                        const isPOS = o.posOrderId && o.posOrderId.startsWith('POS-');
                        const source = isPOS ? 'POS' : 'WooCommerce';
                        const cashierName = source === 'WooCommerce' ? null : (o.cashier?.name || o.cashier?.email || 'Staff');
                        
                        return {
                            id: o.wcOrderId || o.posOrderId, // Prioritize WC ID for display
                            posOrderId: o.posOrderId, // Keep original POS ID for internal logic
                            dbId: o.id, // Keep internal DB ID
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
                    setOrders(dbOrders)
                }
            }
        } catch (error) {
            console.error("Failed to fetch DB orders", error)
        } finally {
            setIsDbLoading(false)
        }
    }, [setOrders])

    const fetchWCOrders = async () => {
        setIsLoading(true)
        try {
            // 1. Trigger the hardened incremental sync + prune via API
            const syncResp = await fetch('/api/sync/orders', { method: 'POST' })
            const syncJson = await syncResp.json()
            
            if (!syncJson.success) {
                console.error("Sync failed:", syncJson.error)
            }

            // 2. Refresh local DB orders (this pulls the newly synced data)
            await fetchDBOrders()
            
            // 3. Clear the legacy direct-fetch state as data is now served from DB
            setWCOrders([])
        } catch (error) {
            console.error("Failed to fetch WC orders", error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchDBOrders()
    }, [fetchDBOrders])

    // Combine and deduplicate orders
    const localOrderIds = new Set(orders.map(o => o.id))
    const uniqueRemoteOrders = wcOrders.filter(o => {
        // Deduplicate: If we already have this order ID locally (happens after sync)
        if (localOrderIds.has(o.id)) return false
        
        // Deduplicate: If it's a POS order from WC, only show it if we DON'T have the local version (original ID)
        if (o.isPosOrder && o.posOrderId) {
            return !localOrderIds.has(o.posOrderId)
        }
        return true 
    })

    const allOrders = [...orders, ...uniqueRemoteOrders].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    // Pagination Logic
    const totalRecords = allOrders.length
    const totalPages = Math.ceil(totalRecords / pageSize)
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = Math.min(startIndex + pageSize, totalRecords)
    const paginatedOrders = allOrders.slice(startIndex, startIndex + pageSize)

    const getPageNumbers = () => {
        const pages = []
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i)
        } else {
            if (currentPage <= 4) {
                for (let i = 1; i <= 5; i++) pages.push(i)
                pages.push('...')
                pages.push(totalPages)
            } else if (currentPage >= totalPages - 3) {
                pages.push(1)
                pages.push('...')
                for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i)
            } else {
                pages.push(1)
                pages.push('...')
                for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i)
                pages.push('...')
                pages.push(totalPages)
            }
        }
        return pages
    }

    const handleViewReceipt = (order: Order) => {
        setSelectedOrder(order)
        setIsReceiptOpen(true)
    }

    // New Print Logic is handled by PrintButton calling react-to-print directly on the receiptRef

    const handleDownloadReceipt = async () => {
        if (receiptRef.current) {
            const canvas = await html2canvas(receiptRef.current)
            const dataUrl = canvas.toDataURL("image/png")
            const link = document.createElement('a')
            link.href = dataUrl
            link.download = `receipt-${selectedOrder?.id}.png`
            link.click()
        }
    }

    const handleRefund = async (order: Order) => {
        if (!confirm(`Are you sure you want to refund Order #${order.id}?`)) return

        try {
            // Check if it's a remote/online order (not in local store, or is marked as synced POS order)
            const isLocal = orders.some(o => o.id === order.id)
            
            if (!isLocal || (order.isPosOrder && order.posOrderId)) {
                // Determine ID to use for WC update (posOrderId if it exists, otherwise order.id)
                const wcId = order.posOrderId || order.id
                
                await updateWooCommerceOrderStatus(wcId, 'cancelled')
                
                // Update local list state for remote orders
                setWCOrders(wcOrders.filter(o => o.id !== order.id))
            }
            
            // If it's in our local store, remove it
            if (isLocal) {
                removeOrder(order.id)
            }

            alert(`Order #${order.id} has been refunded/cancelled successfully.`)
        } catch (error) {
            console.error("Refund failed", error)
            alert("Failed to refund order. Please check console for details.")
        }
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Orders</h2>
                <Button variant="outline" onClick={fetchWCOrders} disabled={isLoading}>
                    {isLoading ? "Syncing..." : "Sync Orders"}
                </Button>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Order ID</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead>Payment Method</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedOrders.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                    No orders found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedOrders.map((order) => (
                                <TableRow key={order.id}>
                                    <TableCell className="font-medium">
                                        #{order.id}
                                    </TableCell>
                                    <TableCell>{new Date(order.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</TableCell>
                                    <TableCell>
                                        <span className={cn(
                                            "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
                                            order.source === 'POS' ? "bg-slate-100 text-slate-700 border border-slate-200" : "bg-blue-50 text-blue-600 border border-blue-100"
                                        )}>
                                            {order.source || 'POS'}
                                        </span>
                                    </TableCell>
                                    <TableCell>{order.items.length} items</TableCell>
                                    <TableCell className="capitalize">{order.paymentMethod}</TableCell>
                                    <TableCell>{formatIDR(order.total)}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="outline" size="sm" onClick={() => handleViewReceipt(order)}>
                                            <Printer className="mr-2 h-4 w-4" />
                                            Receipt
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleRefund(order)} className="text-destructive hover:text-destructive">
                                            <Undo2 className="mr-2 h-4 w-4" />
                                            Refund
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Select
                            value={String(pageSize)}
                            onValueChange={(val) => {
                                 setPageSize(Number(val))
                                 setCurrentPage(1)
                            }}
                        >
                            <SelectTrigger className="h-8 w-[70px]">
                                <SelectValue placeholder={pageSize} />
                            </SelectTrigger>
                            <SelectContent side="top">
                                {[10, 20, 30, 40, 50, 100].map((size) => (
                                    <SelectItem key={size} value={`${size}`}>
                                        {size}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span>rows</span>
                    </div>
                    <span>Viewing {totalRecords > 0 ? startIndex + 1 : 0} to {endIndex} of {totalRecords} records</span>
                </div>
                
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    {getPageNumbers().map((page, index) => (
                        typeof page === 'number' ? (
                            <Button
                                key={index}
                                variant={currentPage === page ? "default" : "outline"}
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => setCurrentPage(page)}
                            >
                                {page}
                            </Button>
                        ) : (
                            <span key={index} className="px-2 text-muted-foreground">
                                <MoreHorizontal className="h-4 w-4" />
                            </span>
                        )
                    ))}

                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages || totalPages === 0}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
                <DialogContent className="max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle>Receipt Preview</DialogTitle>
                        <DialogDescription>Preview and print the receipt</DialogDescription>
                    </DialogHeader>
                    {selectedOrder && (
                        <div className="flex flex-col gap-4 items-center">
                            {/* Scrollable container for the receipt preview */}
                            <div className="max-h-[60vh] overflow-y-auto border p-2 bg-gray-100 w-full flex justify-center">
                                <Receipt order={selectedOrder} ref={receiptRef} />
                            </div>
                            
                            <div className="flex gap-2 w-full">
                                <PrintButton contentRef={receiptRef} className="flex-1" />
                                <Button variant="outline" onClick={handleDownloadReceipt} className="flex-1">
                                    <Download className="mr-2 h-4 w-4" /> Download
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
