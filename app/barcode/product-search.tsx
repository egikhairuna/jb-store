"use client"

import { useState, useEffect, useRef } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Product, useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

interface ProductSearchProps {
  onSelect: (product: Product) => void
}

export function ProductSearch({ onSelect }: ProductSearchProps) {
  const { products } = useStore()
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Filter products based on query, ignoring stock
  const filteredProducts = products.filter((product) => {
    const searchLower = query.toLowerCase()
    const nameMatch = product.name.toLowerCase().includes(searchLower)
    const skuMatch = product.sku.toLowerCase().includes(searchLower)
    
    // Also check variants
    const variantMatch = product.variants?.some(v => 
        v.name.toLowerCase().includes(searchLower) || 
        v.sku.toLowerCase().includes(searchLower)
    )

    return nameMatch || skuMatch || variantMatch
  })

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Choose/Search Product"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-8"
        />
      </div>
      
      {isOpen && query.length > 0 && (
        <div className="absolute top-full z-50 mt-1 max-h-[300px] w-full overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {filteredProducts.length === 0 ? (
            <div className="p-4 text-sm text-center text-muted-foreground">
              No products found.
            </div>
          ) : (
            <div className="p-1">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className={cn(
                    "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground cursor-pointer",
                  )}
                  onClick={() => {
                    onSelect(product)
                    setIsOpen(false)
                    setQuery("")
                  }}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{product.name}</span>
                    <span className="text-xs text-muted-foreground">
                      SKU: {product.sku} | Type: {product.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
