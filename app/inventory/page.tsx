"use client"

import React, { useState, useMemo, useEffect } from "react"
import { useStore, formatIDR } from "@/lib/store"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ArrowDown, ArrowUp, Search, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface InventoryItem {
    productId: string
    variantId: string | null
    name: string
    sku: string
    stock: number
    type: 'simple' | 'variable'
}

export default function InventoryPage() {
  const { products, updateProduct } = useStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)
  const [adjustment, setAdjustment] = useState<number>(0)
  const [isOpen, setIsOpen] = useState(false)
  const [type, setType] = useState<"add" | "remove">("add")
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const flattenedItems = useMemo(() => {
    const items: InventoryItem[] = []
    products.forEach(product => {
        if (product.type === 'simple') {
            items.push({
                productId: product.id,
                variantId: null,
                name: product.name,
                sku: product.sku,
                stock: product.stock,
                type: 'simple'
            })
        } else {
            if (product.variants && product.variants.length > 0) {
                product.variants.forEach(variant => {
                    items.push({
                        productId: product.id,
                        variantId: variant.id,
                        name: `${product.name} - ${variant.name}`,
                        sku: variant.sku,
                        stock: variant.stock,
                        type: 'variable'
                    })
                })
            } else {
                // Fallback for variable products with no variants
                items.push({
                    productId: product.id,
                    variantId: null,
                    name: product.name,
                    sku: product.sku || '-',
                    stock: product.stock || 0,
                    type: 'variable'
                })
            }
        }
    })
    return items
  }, [products])

  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return flattenedItems.filter(item => 
        item.name.toLowerCase().includes(query) || 
        item.sku.toLowerCase().includes(query)
    )
  }, [flattenedItems, searchQuery])

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  // Pagination Logic
  const totalRecords = filteredItems.length
  const totalPages = Math.ceil(totalRecords / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalRecords)
  const paginatedItems = filteredItems.slice(startIndex, startIndex + pageSize)

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

  const handleAdjustment = () => {
    if (selectedProduct && adjustment > 0) {
      const product = products.find((p) => p.id === selectedProduct)
      if (product) {
        if (selectedVariant && product.variants) {
            const updatedVariants = product.variants.map(v => {
                if (v.id === selectedVariant) {
                    const newStock = type === "add" ? v.stock + adjustment : Math.max(0, v.stock - adjustment)
                    return { ...v, stock: newStock }
                }
                return v
            })
            updateProduct(selectedProduct, { variants: updatedVariants })
        } else {
            const newStock =
            type === "add"
                ? product.stock + adjustment
                : Math.max(0, product.stock - adjustment)
            updateProduct(selectedProduct, { stock: newStock })
        }
        setIsOpen(false)
        setAdjustment(0)
        setSelectedProduct(null)
        setSelectedVariant(null)
      }
    }
  }

  const openAdjustment = (productId: string, variantId: string | null, action: "add" | "remove") => {
      setSelectedProduct(productId)
      setSelectedVariant(variantId)
      setType(action)
      setIsOpen(true)
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Inventory</h2>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search product or SKU..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 max-w-sm"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Current Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.map((item, index) => (
              <TableRow key={`${item.productId}-${item.variantId || 'base'}-${index}`}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.sku}</TableCell>
                <TableCell>{item.stock}</TableCell>
                <TableCell>
                    {item.stock < 10 ? (
                        <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                        Low Stock
                        </span>
                    ) : (
                        <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
                        In Stock
                        </span>
                    )}
                </TableCell>
                <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openAdjustment(item.productId, item.variantId, "add")}>
                            <ArrowUp className="mr-2 h-4 w-4" /> Add
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openAdjustment(item.productId, item.variantId, "remove")}>
                            <ArrowDown className="mr-2 h-4 w-4" /> Remove
                        </Button>
                    </div>
                </TableCell>
              </TableRow>
            ))}
            {paginatedItems.length === 0 && (
                <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                        No products found.
                    </TableCell>
                </TableRow>
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

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
            <DialogHeader>
            <DialogTitle>
                {type === "add" ? "Add Stock" : "Remove Stock"}
            </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="adjustment" className="text-right">
                Quantity
                </Label>
                <Input
                id="adjustment"
                type="number"
                value={adjustment}
                onChange={(e) => setAdjustment(Number(e.target.value))}
                className="col-span-3"
                onFocus={(e) => e.target.select()}
                />
            </div>
            </div>
            <Button onClick={handleAdjustment} className="w-full">Confirm</Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
