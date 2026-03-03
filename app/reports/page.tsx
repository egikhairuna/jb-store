"use client"

import { useStore, formatIDR, Order } from "@/lib/store"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { format, isWithinInterval, startOfDay, endOfDay, parseISO, subMonths } from "date-fns"
import { Download, FileSpreadsheet, FileText, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import * as XLSX from "xlsx"
import { getWooCommerceOrders } from "@/app/actions/woocommerce"

export default function ReportsPage() {
  const { orders: localOrders, wcOrders, setWCOrders } = useStore()
  const [isLoading, setIsLoading] = useState(false)
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [isHistoricalRange, setIsHistoricalRange] = useState(false)

  // Tracking if current range is beyond hot window
  useEffect(() => {
    if (startDate) {
        const start = parseISO(startDate)
        const threeMonthsAgo = subMonths(new Date(), 3)
        setIsHistoricalRange(start < threeMonthsAgo)
    } else {
        setIsHistoricalRange(false)
    }
  }, [startDate])

  // FETCH WC ORDERS (For Historical Fallback)
  const fetchHistoricalOrders = async () => {
      setIsLoading(true)
      try {
        // Use user-selected threshold for direct WC query
        const start = startDate ? startOfDay(parseISO(startDate)).toISOString() : undefined
        const end = endDate ? endOfDay(parseISO(endDate)).toISOString() : undefined

        const remoteOrders = await getWooCommerceOrders(1, 100, 'completed', start, end)
        setWCOrders(remoteOrders)
      } catch (error) {
        console.error("Failed to fetch historical orders", error)
      } finally {
        setIsLoading(false)
      }
    }

  // COMBINE ORDERS
  const localOrderIds = new Set(localOrders.map(o => o.id))
  const uniqueRemoteOrders = wcOrders.filter(o => {
    // Deduplicate: Checks if WC ID matches local ID
    if (localOrderIds.has(o.id)) return false

    if (o.isPosOrder && o.posOrderId) {
      return !localOrderIds.has(o.posOrderId)
    }
    return true
  })
  
  const allOrders = [...localOrders, ...uniqueRemoteOrders].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  // FILTER ORDERS
  const filteredOrders = useMemo(() => {
    return allOrders.filter(order => {
        if (!startDate && !endDate) return true
        
        const orderDate = new Date(order.date)
        const start = startDate ? startOfDay(parseISO(startDate)) : new Date(0) // Beginning of time
        const end = endDate ? endOfDay(parseISO(endDate)) : new Date() // Now
        
        return isWithinInterval(orderDate, { start, end })
      })
  }, [allOrders, startDate, endDate])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [startDate, endDate])

  // Pagination Logic
  const totalRecords = filteredOrders.length
  const totalPages = Math.ceil(totalRecords / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalRecords)
  const paginatedOrders = filteredOrders.slice(startIndex, startIndex + pageSize)

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

  // HELPER: Flatten Data for Export
  const getExportData = () => {
      const rows: any[] = [];
      filteredOrders.forEach(order => {
          const cashAmount = order.paymentMethod === 'split' ? (order.cashAmount || 0) : (order.paymentMethod === 'cash' ? order.total : 0);
          const transferAmount = order.paymentMethod === 'split' ? (order.transferAmount || 0) : (order.paymentMethod === 'transfer' ? order.total : 0);

          order.items.forEach(item => {
              rows.push({
                  orderId: order.id,
                  date: format(new Date(order.date), "yyyy-MM-dd HH:mm:ss"),
                  sku: item.sku || '',
                  itemName: `${item.name} ${item.variantName ? `(${item.variantName})` : ''} x${item.quantity}`, // User requested "Items Name" format "Jacket (S) x1"
                  quantity: item.quantity,
                  price: item.price,
                  discount: order.discount, // Repeating order level info
                  shipping: 0, // Not currently tracked in local store, maybe available in WC order? For now 0.
                  total: order.total,
                  paymentMethod: order.paymentMethod,
                  transfer: transferAmount,
                  cash: cashAmount
              });
          });
      });
      return rows;
  }

  // EXPORT CSV
  const handleExportCSV = () => {
    const headers = ["Order ID", "Date", "SKU", "Items Name", "Quantity", "Price", "Disc", "Shipping", "Total", "Payment Method", "Transfer", "Cash"]
    const rows = getExportData();
    
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        [
          row.orderId,
          row.date,
          `"${row.sku.replace(/"/g, '""')}"`,
          `"${row.itemName.replace(/"/g, '""')}"`,
          row.quantity,
          row.price,
          row.discount,
          row.shipping,
          row.total,
          row.paymentMethod,
          row.transfer,
          row.cash
        ].join(",")
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `sales_report_${format(new Date(), "yyyyMMdd")}.csv`
    link.click()
  }
  
  // EXPORT XLS
  const handleExportXLS = () => {
    const rows = getExportData().map(row => ({
        "Order ID": row.orderId,
        "Date": row.date,
        "SKU": row.sku,
        "Items Name": row.itemName,
        "Quantity": row.quantity,
        "Price": row.price,
        "Disc": row.discount,
        "Shipping": row.shipping,
        "Total": row.total,
        "Payment Method": row.paymentMethod,
        "Transfer": row.transfer,
        "Cash": row.cash
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Report")
    XLSX.writeFile(workbook, `sales_report_${format(new Date(), "yyyyMMdd")}.xlsx`)
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
        
        <div className="flex flex-col sm:flex-row gap-3 items-center">
            {/* Date Filters */}
            <div className="flex items-center gap-2">
                <Input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-[150px]"
                />
                <span className="text-muted-foreground">-</span>
                <Input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-[150px]"
                />
            </div>

            {/* Historical Fallback Button */}
            {isHistoricalRange && (
                <Button 
                    variant="outline" 
                    onClick={fetchHistoricalOrders} 
                    disabled={isLoading}
                    className="text-orange-600 border-orange-200 bg-orange-50 hover:bg-orange-100"
                >
                    <Download className="mr-2 h-4 w-4" />
                    Fetch History
                </Button>
            )}

            {/* Export Dropdown */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button disabled={filteredOrders.length === 0}>
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleExportCSV}>
                        <FileText className="mr-2 h-4 w-4" />
                        CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportXLS}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Microsoft Excel (XLSX)
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                  {isLoading ? "Loading..." : "No orders found for the selected criteria."}
                </TableCell>
              </TableRow>
            ) : (
              paginatedOrders.map((order) => {
                const isOnline = !order.posOrderId && !localOrders.find(o => o.id === order.id)
                return (
                    <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>
                        {format(new Date(order.date), "MMM dd, yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                        {isOnline 
                            ? <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">Online</span>
                            : <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">POS</span>
                        }
                    </TableCell>
                    <TableCell>
                        {order.items.map((item, idx) => (
                        <div key={idx} className="text-sm">
                            {item.name} {item.variantName ? `(${item.variantName})` : ''} x{item.quantity}
                        </div>
                        ))}
                    </TableCell>
                    <TableCell className="capitalize">
                        {order.paymentMethod === 'split' 
                            ? (
                                <div>
                                    <div>Split Bill</div>
                                    <div className="text-xs text-muted-foreground">Cash: {formatIDR(order.cashAmount || 0)}</div>
                                    <div className="text-xs text-muted-foreground">Trf: {formatIDR(order.transferAmount || 0)}</div>
                                </div>
                            )
                            : order.paymentMethod
                        }
                    </TableCell>
                    <TableCell className="text-right">
                        {formatIDR(order.total)}
                    </TableCell>
                    </TableRow>
                )
              })
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
    </div>
  )
}
