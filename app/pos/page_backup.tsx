"use client"

import { Search, ShoppingCart, Trash2, Plus, Minus, Printer, Download } from "lucide-react"
import { useStore, Product, formatIDR, CartItem } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent } from "@/components/ui/card"
import { useState, useRef, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import html2canvas from "html2canvas"
import dynamic from 'next/dynamic'
import { createWooCommerceOrder, getProductVariants } from "@/app/actions/woocommerce"

const Barcode = dynamic(() => import("react-barcode"), { ssr: false })

export default function POSPage() {
  const { products, cart, addToCart, removeFromCart, updateCartQuantity, clearCart, updateProduct, addOrder, setProductVariants } = useStore()
  const [search, setSearch] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false)
  const [isLoadingVariants, setIsLoadingVariants] = useState(false)
  const [discount, setDiscount] = useState<number>(0)
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent")
  const [taxRate, setTaxRate] = useState<number>(0)
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer" | "split">("cash")
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [lastOrder, setLastOrder] = useState<any>(null)
  const receiptRef = useRef<HTMLDivElement>(null)

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 12

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [search])

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const handleProductClick = async (product: Product) => {
    if (product.type === "variable") {
      setSelectedProduct(product)
      setIsVariantDialogOpen(true)

      // Lazy load variants if missing
      if (!product.variants || product.variants.length === 0) {
          setIsLoadingVariants(true)
          try {
              const variants = await getProductVariants(product.id)
              setProductVariants(product.id, variants)
              // Update selected product reference to include new variants
              setSelectedProduct({ ...product, variants })
          } catch (e) {
              console.error(e)
              alert("Failed to load variants")
          } finally {
              setIsLoadingVariants(false)
          }
      }
    } else {
      addToCart(product)
    }
  }

  const handleVariantSelect = (variantId: string) => {
    if (selectedProduct) {
      addToCart(selectedProduct, variantId)
      setIsVariantDialogOpen(false)
      setSelectedProduct(null)
    }
  }

  /* 
   * NEW: Split Payment State
   */
  const [splitCash, setSplitCash] = useState<number>(0)
  const [splitTransfer, setSplitTransfer] = useState<number>(0)
  
  // ... existing code ...

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0)
  const discountAmount = discountType === "percent" ? subtotal * (discount / 100) : discount
  const tax = (subtotal - discountAmount) * (taxRate / 100)
  const total = subtotal - discountAmount + tax

  // NEW: Validation for split payment
  const isSplitValid = paymentMethod === 'split' 
    ? (splitCash + splitTransfer) === total
    : true

  const handleCheckout = async () => {
    if (cart.length === 0) return
    if (!isSplitValid) return // Prevent checkout if split is invalid

    // Update inventory (Local)
    cart.forEach(item => {
        const product = products.find(p => p.id === item.id)
        if (product) {
            if (item.variantId && product.variants) {
                const updatedVariants = product.variants.map(v => 
                    v.id === item.variantId ? { ...v, stock: v.stock - item.quantity } : v
                )
                updateProduct(product.id, { variants: updatedVariants })
            } else {
                updateProduct(product.id, { stock: product.stock - item.quantity })
            }
        }
    })

    const orderId = Math.random().toString(36).substr(2, 9).toUpperCase();

    const order = {
        id: orderId,
        date: new Date().toISOString(),
        items: [...cart],
        subtotal,
        tax,
        discount: discountAmount,
        total,
        paymentMethod,
        // NEW: Add split details if applicable
        cashAmount: paymentMethod === 'split' ? splitCash : undefined,
        transferAmount: paymentMethod === 'split' ? splitTransfer : undefined
    }
    
    // SYNC WITH WOOCOMMERCE
    try {
        const line_items = cart.map(item => ({
            product_id: parseInt(item.id),
            quantity: item.quantity,
            variation_id: item.variantId ? parseInt(item.variantId) : undefined
        }));

        const woocommerceOrder = {
            payment_method: paymentMethod === 'split' ? 'other' : (paymentMethod === 'cash' ? 'cod' : 'bacs'),
            payment_method_title: paymentMethod === 'split' ? 'Split Payment' : (paymentMethod === 'cash' ? 'Cash' : 'Direct Bank Transfer'),
            set_paid: true,
            line_items,
            status: 'completed',
            meta_data: [
                { key: 'pos_order_id', value: orderId },
                { key: 'pos_cash_amount', value: paymentMethod === 'split' ? splitCash : (paymentMethod === 'cash' ? total : 0) },
                { key: 'pos_transfer_amount', value: paymentMethod === 'split' ? splitTransfer : (paymentMethod === 'transfer' ? total : 0) }
            ]
        };
        
        console.log("Creating WooCommerce Order...", woocommerceOrder);
        await createWooCommerceOrder(woocommerceOrder);
        console.log("WooCommerce Order Created!");
        
    } catch (error) {
        console.error("Failed to sync order to WooCommerce", error);
        alert("Failed to sync order to WooCommerce. Check console for details.");
    }

    addOrder(order)
    setLastOrder(order)
    clearCart()
    setDiscount(0)
    setTaxRate(0)
    // Reset split state
    setSplitCash(0)
    setSplitTransfer(0)
    setIsReceiptOpen(true)
  }

  const handlePrintReceipt = () => {
      const content = receiptRef.current
      if (content) {
          const printWindow = window.open('', '', 'height=600,width=800')
          if (printWindow) {
              printWindow.document.write('<html><head><title>Receipt</title>')
              // Added img CSS to ensure logo prints well
              printWindow.document.write('<style>body { font-family: monospace; width: 80mm; } .text-right { text-align: right; } .flex { display: flex; justify-content: space-between; } .center { text-align: center; display: flex; flex-direction: column; align-items: center; } .bold { font-weight: bold; } .border-b { border-bottom: 1px dashed #000; margin: 5px 0; } img { max-width: 100px; height: auto; } svg { max-width: 100%; }</style>')
              printWindow.document.write('</head><body>')
              printWindow.document.write(content.innerHTML)
              printWindow.document.write('</body></html>')
              printWindow.document.close()
              // Slight delay to ensure images/svgs load before printing
              setTimeout(() => {
                  printWindow.print()
              }, 500)
          }
      }
  }

  const handleDownloadReceipt = async () => {
      if (receiptRef.current) {
          const canvas = await html2canvas(receiptRef.current)
          const dataUrl = canvas.toDataURL("image/png")
          const link = document.createElement('a')
          link.href = dataUrl
          link.download = `receipt-${lastOrder?.id}.png`
          link.click()
      }
  }

  return (
    <div className="flex h-[calc(100vh-2rem)] gap-4 p-4 overflow-hidden">
      {/* Product Grid */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden min-h-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 pb-4">
            {paginatedProducts.map((product) => (
              <Card
                key={product.id}
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => handleProductClick(product)}
              >
                <CardContent className="p-4">
                  <div className="aspect-square w-full rounded-md bg-muted overflow-hidden relative">
                      {product.image ? (
                          <img 
                            src={product.image} 
                            alt={product.name} 
                            className="w-full h-full object-cover"
                          />
                      ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                              No Image
                          </div>
                      )}
                  </div>
                  <div className="mt-2">
                    <h3 className="font-semibold">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">{product.sku}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="font-bold">
                          {product.type === 'variable' 
                            ? (product.variants && product.variants.length > 0 
                                ? `${formatIDR(Math.min(...product.variants.map(v => v.price)))} - ${formatIDR(Math.max(...product.variants.map(v => v.price)))}`
                                : formatIDR(product.price)
                              )
                            : formatIDR(product.price)
                          }
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                        {product.type === 'variable' 
                            ? (product.variants && product.variants.length > 0 ? `${product.variants.length} Variants` : 'Select to view variants')
                            : `Stock: ${product.stock}`
                        }
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
        
        {/* Pagination Controls */}
        <div className="flex items-center justify-between pt-2 border-t mt-auto">
            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
            >
                Previous
            </Button>
            <span className="text-sm text-muted-foreground">
                Page {currentPage} of {Math.max(1, totalPages)}
            </span>
            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
            >
                Next
            </Button>
        </div>
      </div>

      {/* Cart */}
      <div className="flex w-96 flex-col rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden min-h-0">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-semibold">Current Order</h2>
          <Button variant="ghost" size="icon" onClick={clearCart}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {cart.map((item) => (
              <div key={`${item.id}-${item.variantId || 'simple'}`} className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-medium">
                      {item.name} {item.variantName && <span className="text-muted-foreground text-sm">({item.variantName})</span>}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {formatIDR(item.price)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                        if (item.quantity > 1) {
                            updateCartQuantity(item.id, item.variantId, item.quantity - 1)
                        } else {
                            removeFromCart(item.id, item.variantId)
                        }
                    }}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-4 text-center text-sm">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateCartQuantity(item.id, item.variantId, item.quantity + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="flex h-40 flex-col items-center justify-center text-muted-foreground">
                <ShoppingCart className="h-8 w-8 mb-2" />
                <p>Cart is empty</p>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="border-t p-4 space-y-4">
            {/* Discount Section */}
            <div className="space-y-2">
                <Label>Discount</Label>
                <div className="flex gap-2">
                    <Select value={discountType} onValueChange={(val: "percent" | "fixed") => setDiscountType(val)}>
                        <SelectTrigger className="w-[100px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="percent">%</SelectItem>
                            <SelectItem value="fixed">Rp</SelectItem>
                        </SelectContent>
                    </Select>
                    <Input 
                        type="number" 
                        value={discount} 
                        onChange={(e) => setDiscount(Number(e.target.value))}
                        placeholder="0"
                    />
                </div>
            </div>

            {/* Tax Section */}
            <div className="space-y-2">
                <Label>Tax (%)</Label>
                <Input 
                    type="number" 
                    value={taxRate} 
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    placeholder="0"
                />
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
                <Label>Payment Method</Label>
                <RadioGroup value={paymentMethod} onValueChange={(val: "cash" | "transfer" | "split") => setPaymentMethod(val)} className="flex flex-wrap gap-4">
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="cash" id="cash" />
                        <Label htmlFor="cash">Cash</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="transfer" id="transfer" />
                        <Label htmlFor="transfer">Transfer</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="split" id="split" />
                        <Label htmlFor="split">Split Bill</Label>
                    </div>
                </RadioGroup>

                {/* NEW: Split Inputs */}
                {paymentMethod === 'split' && (
                    <div className="grid grid-cols-2 gap-4 mt-2">
                        <div className="space-y-1">
                            <Label htmlFor="split-cash">Cash</Label>
                            <Input
                                id="split-cash"
                                type="number"
                                value={splitCash}
                                onChange={(e) => setSplitCash(Number(e.target.value))}
                                placeholder="Cash Amount"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="split-transfer">Transfer</Label>
                            <Input
                                id="split-transfer"
                                type="number"
                                value={splitTransfer}
                                onChange={(e) => setSplitTransfer(Number(e.target.value))}
                                placeholder="Transfer Amount"
                            />
                        </div>
                         <div className="col-span-2 text-sm">
                            <div className="flex justify-between">
                                <span>Total Paid:</span>
                                <span className={(splitCash + splitTransfer) === total ? "text-green-600" : "text-red-500"}>
                                    {formatIDR(splitCash + splitTransfer)}
                                </span>
                            </div>
                            {(splitCash + splitTransfer) !== total && (
                                <div className="text-red-500 text-xs">
                                    Must match total: {formatIDR(total)} (Diff: {formatIDR(total - (splitCash + splitTransfer))})
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

          <div className="space-y-2 pt-2 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatIDR(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                <span className="text-muted-foreground">Discount</span>
                <span>-{formatIDR(discountAmount)}</span>
                </div>
            )}
            {tax > 0 && (
                <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                <span>{formatIDR(tax)}</span>
                </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>{formatIDR(total)}</span>
            </div>
          </div>
          <Button className="w-full" size="lg" onClick={handleCheckout} disabled={cart.length === 0 || !isSplitValid}>
            Checkout
          </Button>
        </div>
      </div>

      {/* Variant Selection Dialog */}
      <Dialog open={isVariantDialogOpen} onOpenChange={setIsVariantDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Select Variant</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                  {isLoadingVariants ? (
                      <div className="flex justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                  ) : (
                      selectedProduct?.variants?.map((variant) => (
                       <Button 
                         key={variant.id} 
                         variant="outline" 
                         className="justify-between h-auto py-4"
                         onClick={() => handleVariantSelect(variant.id)}
                         disabled={variant.stock === 0}
                       >
                           <div className="text-left">
                               <div className="font-semibold">{variant.name}</div>
                               <div className="text-xs text-muted-foreground">{variant.sku}</div>
                           </div>
                           <div className="text-right">
                               <div className="font-semibold">{formatIDR(variant.price)}</div>
                               <div className="text-xs text-muted-foreground">Stock: {variant.stock}</div>
                           </div>
                       </Button>
                   ))
                  )}
                  {!isLoadingVariants && selectedProduct?.variants?.length === 0 && (
                      <div className="text-center text-muted-foreground py-4">
                          No variants found.
                      </div>
                  )}
              </div>
          </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
          <DialogContent className="max-w-[400px] h-[80vh] overflow-y-auto">
              <DialogHeader>
                  <DialogTitle>Receipt</DialogTitle>
              </DialogHeader>
              <div className="border p-4 bg-white text-black text-sm font-mono flex flex-col gap-2" ref={receiptRef}>
                  <div className="center text-center flex flex-col items-center gap-1 mb-2">
                       {/* Logo */}
                      <img src="/store_logo.png" alt="Logo" className="w-8 h-auto mb-7" />
                      <div className="font-bold text-lg font-bold">JAMES BOOGIE</div>
                      <div>Jl. Gambir Saketi No. 44 Sukaluyu, Kec. Cibeunying Kaler, Kota Bandung, Jawa Barat 40123</div>
                      <div>Telp:  085157000263</div>
                  </div>
                  <div className="border-b mb-2"></div>
                  <div className="flex justify-between mb-2">
                      <span>Date: {lastOrder && new Date(lastOrder.date).toLocaleDateString()}</span>
                      <span>
                          Time: {lastOrder && new Date(lastOrder.date).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })}
                      </span>
                  </div>
                  <div className="flex justify-between mb-4">
                      <span className="capitalize">Order ID: {lastOrder?.id}</span>
                      <span className="capitalize">{lastOrder?.paymentMethod === 'split' ? 'Split Bill' : lastOrder?.paymentMethod}</span>
                  </div>
                  {lastOrder?.paymentMethod === 'split' && (
                       <div className="text-sm font-light mb-4 text-gray-600">
                           <div className="flex justify-between">
                               <span> - Cash</span>
                               <span>{formatIDR(lastOrder.cashAmount || 0)}</span>
                           </div>
                           <div className="flex justify-between">
                               <span> - Transfer</span>
                               <span>{formatIDR(lastOrder.transferAmount || 0)}</span>
                           </div>
                       </div>
                  )}
                  <div className="border-b mb-2"></div>
                  <div className="space-y-2 mb-4">
                      {lastOrder?.items.map((item: any, index: number) => (
                          <div key={index} className="flex justify-between">
                              <span>{item.name} {item.variantName ? `(${item.variantName})` : ''} x{item.quantity}</span>
                              <span>{formatIDR(item.price * item.quantity)}</span>
                          </div>
                      ))}
                  </div>
                  <div className="border-b mb-2"></div>
                  <div className="space-y-1">
                      <div className="flex justify-between">
                          <span>Subtotal</span>
                          <span>{lastOrder && formatIDR(lastOrder.subtotal)}</span>
                      </div>
                      {lastOrder?.discount > 0 && (
                        <div className="flex justify-between">
                            <span>Discount</span>
                            <span>-{formatIDR(lastOrder.discount)}</span>
                        </div>
                      )}
                      {lastOrder?.tax > 0 && (
                          <div className="flex justify-between">
                              <span>Tax</span>
                              <span>{lastOrder && formatIDR(lastOrder.tax)}</span>
                          </div>
                      )}
                      <div className="flex justify-between font-bold text-lg mt-2">
                          <span>Total</span>
                          <span>{lastOrder && formatIDR(lastOrder.total)}</span>
                      </div>
                  </div>
                  <div className="border-b mt-4 mb-4"></div>
                  <div className="center text-center flex flex-col items-center">
                      <div className="mb-4">Thank you for your purchase!</div>
                      {lastOrder && <Barcode value={lastOrder.id} width={1} height={40} fontSize={14} />}
                  </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button variant="outline" className="w-full" onClick={handleDownloadReceipt}>
                      <Download className="mr-2 h-4 w-4" /> Download
                  </Button>
                  <Button className="w-full" onClick={handlePrintReceipt}>
                      <Printer className="mr-2 h-4 w-4" /> Print
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  )
}
