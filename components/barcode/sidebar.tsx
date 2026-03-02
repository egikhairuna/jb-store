"use client"

import { useState } from "react"
import { useStore, Product } from "@/lib/store"
import { useBarcodeStore } from "@/lib/store/barcode-store"
import {
  Check,
  ChevronsUpDown,
  Plus,
  Minus,
  Trash2,
  Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

export function BarcodeSidebar() {
  const { products } = useStore()
  const { items, addItem, updateQuantity, removeItem } =
    useBarcodeStore()

  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")

  type SearchItem =
    | { id: string; type: "product"; name: string; sku: string; product: Product }
    | { id: string; type: "variant"; name: string; sku: string; product: Product; variant: NonNullable<Product["variants"]>[number] }

  /**
   * Flatten products for search:
   * - Simple products
   * - Variants
   */
  const searchItems = products.flatMap((p): SearchItem[] => {
    if (p.type === "simple") {
      return [
        {
          id: p.id,
          type: "product" as const,
          name: p.name,
          sku: p.sku,
          product: p,
        },
      ]
    }

    return (
      p.variants?.map((v) => ({
        id: v.id,
        type: "variant" as const,
        name: `${p.name} - ${v.name}`,
        sku: v.sku,
        product: p,
        variant: v,
      })) ?? []
    )
  })

  return (
    <div className="flex flex-col h-full bg-background border-r">
      {/* ================= SEARCH ================= */}
      <div className="p-4 border-b space-y-3">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
          Barcode Queue
        </h2>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
            >
              {value || "Search product or variant..."}
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-[320px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search by name or SKU..." />
              <CommandList>
                <CommandEmpty>No product found.</CommandEmpty>
                <CommandGroup>
                  {searchItems.map((item) => (
                    <CommandItem
                      key={`${item.type}-${item.id}`}
                      value={item.name}
                      onSelect={() => {
                        if (item.type === "product") {
                          addItem({
                            id: item.product.id,
                            productName: item.product.name,
                            sku: item.product.sku,
                            price: item.product.price,
                            quantity: 1,
                          })
                        } else {
                          addItem({
                            id: item.product.id,
                            variantId: item.variant!.id,
                            productName: item.product.name,
                            variantName: item.variant!.name,
                            sku: item.variant!.sku,
                            price: item.variant!.price,
                            quantity: 1,
                          })
                        }

                        setOpen(false)
                        setValue("")
                      }}
                    >
                      <Check className="mr-2 h-4 w-4 opacity-0" />
                      <div className="flex flex-col">
                        <span>{item.name}</span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {item.sku}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* ================= QUEUE ================= */}
      <ScrollArea className="flex-1 bg-muted/10">
        <div className="p-4 space-y-3">
          {items.map((item, index) => (
            <div
              key={`${item.id}-${item.variantId}-${index}`}
              className="flex items-center justify-between p-3 bg-card border rounded-lg shadow-sm"
            >
              {/* Info */}
              <div className="flex-1 min-w-0 mr-4">
                <p className="font-medium text-sm truncate">
                  {item.productName}
                </p>

                {item.variantName && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1 py-0 h-4 my-1"
                  >
                    {item.variantName}
                  </Badge>
                )}

                <p className="text-xs font-mono text-muted-foreground">
                  {item.sku}
                </p>
              </div>

              {/* Quantity Control */}
              <div className="flex items-center gap-2">
                <div className="flex items-center h-8 border rounded-md bg-background">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-full w-8 rounded-none border-r"
                    onClick={() =>
                      updateQuantity(index, item.quantity - 1)
                    }
                    disabled={item.quantity <= 1}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>

                  {/* EDITABLE INPUT */}
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    className="w-12 h-full text-center text-sm font-medium bg-transparent outline-none"
                    value={item.quantity}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      if (!Number.isNaN(value) && value >= 1) {
                        updateQuantity(index, value)
                      }
                    }}
                    onBlur={(e) => {
                      if (!e.target.value || Number(e.target.value) < 1) {
                        updateQuantity(index, 1)
                      }
                    }}
                  />

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-full w-8 rounded-none border-l"
                    onClick={() =>
                      updateQuantity(index, item.quantity + 1)
                    }
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeItem(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <div className="text-center py-10 px-4 text-muted-foreground border-2 border-dashed rounded-lg">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">
                Your queue is empty
              </p>
              <p className="text-xs">
                Search above to add products
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ================= FOOTER ================= */}
      {items.length > 0 && (
        <div className="p-4 border-t bg-muted/30">
          <div className="flex justify-between items-center text-sm font-medium">
            <span>Total Labels</span>
            <Badge>
              {items.reduce((acc, i) => acc + i.quantity, 0)}
            </Badge>
          </div>
        </div>
      )}
    </div>
  )
}
