"use client"

import { Search, ShoppingCart, Trash2, Plus, Minus, Printer, Download, Loader2, User, FileText, Tag, Percent, NotebookPen } from "lucide-react"
import { useStore, Product, formatIDR, CartItem, Order, formatNumber, parseNumber } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent } from "@/components/ui/card"
import { useState, useRef, useEffect } from "react"
import { useSession } from "next-auth/react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
import { Receipt } from "@/components/receipt"
import { PrintButton } from "@/components/print-button"
import { createWooCommerceOrder, getProductVariants, getWooCommerceCustomers, validateStock, StockValidationResult } from "@/app/actions/woocommerce"

export default function POSPage() {
  const { products, cart, addToCart, removeFromCart, updateCartQuantity, clearCart, updateProduct, addOrder, setProductVariants, batchUpdateInventory } = useStore()
  const { data: session } = useSession()
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
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const receiptRef = useRef<HTMLDivElement>(null)

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 12

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [search])

  // ULTIMATE SYNC: Trigger background sync on login
  useEffect(() => {
    if (session?.user) {
        console.log("[POS] Initial Login Sync started in background...");
        // Non-blocking background sync
        fetch("/api/worker?mode=products&key=" + (process.env.NEXT_PUBLIC_WORKER_KEY || ""), { method: "POST" })
            .catch(err => console.error("Background sync trigger failed", err));
    }
  }, [session]);

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

  // Customer & Note State
  const [customerSearch, setCustomerSearch] = useState("")
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [orderNote, setOrderNote] = useState("")
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false)

  // Search Customers Effect
  useEffect(() => {
    const timer = setTimeout(async () => {
        if (customerSearch.length > 2) {
            const results = await getWooCommerceCustomers(customerSearch)
            setCustomers(results)
            setIsCustomerSearchOpen(true)
        }
    }, 500)
    return () => clearTimeout(timer)
  }, [customerSearch])
  
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
    if (!isSplitValid) return 
    
    setIsCheckingOut(true)

    try {
        // ========================================
        // STEP 1: VALIDATE STOCK (CRITICAL SECTION)
        // ========================================
        console.log('[Checkout] Step 1: Validating stock...');
        
        let validationResult: StockValidationResult;
        let isOffline = false;

        try {
            validationResult = await validateStock(cart);
        } catch (error: any) {
            // Network error detected - trigger offline mode
            console.error('[Checkout] Stock validation failed (network error):', error);
            isOffline = true;
            
            // Show offline confirmation dialog
            const confirmOffline = window.confirm(
                '⚠️ SYSTEM OFFLINE\n\n' +
                'Cannot verify stock availability.\n' +
                'Proceeding may result in overselling.\n\n' +
                'Continue with offline checkout?'
            );

            if (!confirmOffline) {
                console.log('[Checkout] User cancelled offline checkout');
                return;
            }

            console.log('[Checkout] User confirmed offline checkout - proceeding with risk');
        }

        // Check validation results (if online)
        if (!isOffline && !validationResult!.valid) {
            const errorMessages = validationResult!.errors.map(err => 
                `• ${err.name}: ${err.reason}\n  Requested: ${err.requested}, Available: ${err.available}`
            ).join('\n\n');

            alert(
                '❌ CHECKOUT FAILED\n\n' +
                'The following items are unavailable:\n\n' +
                errorMessages +
                '\n\nPlease remove these items or reduce quantities.'
            );

            console.log('[Checkout] Validation failed:', validationResult!.errors);
            return;
        }

        console.log('[Checkout] Stock validation passed');

        // ========================================
        // STEP 2: CREATE ORDER DATA
        // ========================================
        const orderId = Math.random().toString(36).substr(2, 9).toUpperCase();

        const order: Order = {
            id: orderId,
            date: new Date().toISOString(),
            items: [...cart],
            subtotal,
            tax,
            discount: discountAmount,
            total,
            paymentMethod,
            cashAmount: paymentMethod === 'split' ? splitCash : undefined,
            transferAmount: paymentMethod === 'split' ? splitTransfer : undefined,
            syncStatus: isOffline ? ('pending' as const) : ('synced' as const),
            cashierName: session?.user?.name ?? session?.user?.email ?? 'Staff',
        }

        let finalOrderId = orderId;

        // ========================================
        // STEP 3: SYNC WITH WOOCOMMERCE (if online)
        // ========================================
        if (!isOffline) {
            try {
                console.log('[Checkout] Step 2: Creating WooCommerce order...');

                const line_items = cart.map(item => ({
                    product_id: parseInt(item.id),
                    quantity: item.quantity,
                    variation_id: item.variantId ? parseInt(item.variantId) : undefined
                }));

                const woocommerceOrder = {
                    payment_method: paymentMethod === 'split' ? 'other' : (paymentMethod === 'cash' ? 'cod' : 'bacs'),
                    payment_method_title: paymentMethod === 'split' ? 'Split Payment' : (paymentMethod === 'cash' ? 'Cash' : 'Direct Bank Transfer'),
                    set_paid: true,
                    customer_id: selectedCustomer ? selectedCustomer.id : 0,
                    customer_note: orderNote,
                    billing: selectedCustomer ? {
                        first_name: selectedCustomer.firstName,
                        last_name: selectedCustomer.lastName,
                        email: selectedCustomer.email
                    } : {
                        first_name: 'Flagship',
                        last_name: 'Store',
                        email: 'pos@store.com'
                    },
                    line_items,
                    status: 'completed',
                    meta_data: [
                        { key: 'pos_order_id', value: orderId },
                        { key: 'pos_cash_amount', value: paymentMethod === 'split' ? splitCash : (paymentMethod === 'cash' ? total : 0) },
                        { key: 'pos_transfer_amount', value: paymentMethod === 'split' ? splitTransfer : (paymentMethod === 'transfer' ? total : 0) },
                        { key: 'pos_note', value: orderNote || 'Flagship Store' } 
                    ]
                };

                const createdOrder = await createWooCommerceOrder(woocommerceOrder);
                console.log('[Checkout] WooCommerce order created:', createdOrder);

                if (createdOrder && createdOrder.id) {
                    finalOrderId = String(createdOrder.id);
                }

            } catch (error: any) {
                console.error('[Checkout] Failed to create WooCommerce order:', error);
                
                // Check if it's a stock-related error (race condition)
                if (error.response?.data?.message?.includes('stock') || 
                    error.response?.data?.message?.includes('inventory')) {
                    alert(
                        '❌ ORDER FAILED\n\n' +
                        'Stock became unavailable during checkout.\n' +
                        'This can happen when multiple sales occur simultaneously.\n\n' +
                        'Please try again.'
                    );
                    return;
                }

                // Other WooCommerce errors
                alert(
                    '⚠️ SYNC FAILED\n\n' +
                    'Order could not be synced to WooCommerce.\n' +
                    'Error: ' + (error.response?.data?.message || error.message) +
                    '\n\nOrder will be saved locally for manual sync.'
                );

                // Mark as pending sync
                order.syncStatus = 'failed';
            }
        }

        // ========================================
        // STEP 4: UPDATE LOCAL INVENTORY
        // ========================================
        console.log('[Checkout] Step 3: Updating local inventory...');
        const inventoryUpdates = cart.map(item => ({
            id: item.id,
            variantId: item.variantId,
            quantity: item.quantity
        }));
        
        batchUpdateInventory(inventoryUpdates);

        // ========================================
        // STEP 5: SAVE TO LOCAL DATABASE (PHASE 2)
        // ========================================
        console.log('[Checkout] Step 4: Saving to local database...');
        try {
            const dbResponse = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    posOrderId: orderId,
                    wcOrderId: finalOrderId !== orderId ? finalOrderId : null,
                    items: cart,
                    subtotal,
                    discountAmount,
                    discountType,
                    taxAmount: tax,
                    total,
                    paymentMethod,
                    syncStatus: (order.syncStatus || 'pending').toUpperCase() // PENDING, SYNCED, FAILED
                })
            });
            
            if (!dbResponse.ok) {
                console.warn('[Checkout] Failed to save order to database');
            } else {
                const dbOrder = await dbResponse.json();
                console.log('[Checkout] Order saved to database:', dbOrder);
            }
        } catch (dbError) {
            console.error('[Checkout] Error saving to database:', dbError);
        }

        // ========================================
        // STEP 6: SAVE TO ZUSTAND (FOR UI)
        // ========================================
        console.log('[Checkout] Step 5: Saving to local state...');
        const finalOrder = { ...order, id: finalOrderId }

        addOrder(finalOrder)
        setLastOrder(finalOrder)
        
        // ========================================
        // STEP 6: RESET UI STATE
        // ========================================
        console.log('[Checkout] Step 5: Resetting UI...');
        clearCart()
        setDiscount(0)
        setTaxRate(0)
        setSplitCash(0)
        setSplitTransfer(0)
        setSelectedCustomer(null)
        setOrderNote("")
        setCustomerSearch("")
        
        setIsReceiptOpen(true)
        console.log('[Checkout] ✅ Checkout completed successfully');

    } catch (error) {
        console.error('[Checkout] Unexpected error:', error)
        alert('An unexpected error occurred. Please try again.');
    } finally {
        setIsCheckingOut(false)
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
    <div className="flex gap-4 p-4">
      {/* Cart */}
      <div className="flex w-96 flex-col rounded-lg border bg-card text-card-foreground shadow-sm h-[calc(100vh-2rem)] overflow-hidden min-h-0 sticky top-0 z-10">
        {/* Sidebar Header */}
        <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            <h2 className="font-bold text-sm uppercase tracking-wider">Current Order</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={clearCart} className="h-8 w-8 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable Content: Items */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-5">
            {/* Cart Items */}
            <div className="space-y-3">
                {cart.map((item) => (
                  <div key={`${item.id}-${item.variantId || 'simple'}`} className="flex items-center justify-between gap-3 bg-background border rounded-lg p-2.5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Item Image */}
                      <div className="h-10 w-10 shrink-0 rounded-md bg-muted overflow-hidden border">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <ShoppingCart className="h-4 w-4 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-[11px] leading-tight truncate">{item.name}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {item.variantName && (
                              <span className="inline-block px-1.5 py-0.5 rounded-md bg-muted text-[9px] font-medium text-muted-foreground">
                                  {item.variantName}
                              </span>
                          )}
                          <span className="text-[11px] font-bold text-primary">{formatIDR(item.price)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-muted/30 rounded-full p-1 border shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full hover:bg-background shadow-sm"
                        onClick={() => {
                            if (item.quantity > 1) {
                                updateCartQuantity(item.id, item.variantId, item.quantity - 1)
                            } else {
                                removeFromCart(item.id, item.variantId)
                            }
                        }}
                      >
                        <Minus className="h-2.5 w-2.5" />
                      </Button>
                      
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.quantity}
                        onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '')
                            const newQty = val ? parseInt(val, 10) : 0
                            if (newQty > 0) {
                                updateCartQuantity(item.id, item.variantId, newQty)
                            } else if (val === '') {
                                // Allow empty temporarily for typing, but effectively 0/invalid until a number is typed
                                // The user can delete the item with the Minus button
                            }
                        }}
                        className="w-8 h-6 bg-transparent text-center text-[11px] font-bold outline-none border-none focus:ring-0 appearance-none"
                      />

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full hover:bg-background shadow-sm"
                        onClick={() => updateCartQuantity(item.id, item.variantId, item.quantity + 1)}
                      >
                        <Plus className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>

            {cart.length === 0 && (
              <div className="flex h-40 flex-col items-center justify-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                    <ShoppingCart className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <div className="text-center">
                    <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">Cart is empty</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Sidebar Footer: Fixed Order Settings, Totals and Checkout */}
        <div className="border-t p-4 space-y-4 bg-background shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
            {/* Action Buttons & Payment Method (Moved here) */}
            <div className="space-y-4">
                <div className="grid grid-cols-4 gap-2">
                    {/* Customer Button */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className={`h-10 flex-col gap-0.5 px-0 text-[9px] font-bold transition-all ${selectedCustomer ? "bg-primary/10 text-primary border-primary/20" : "text-muted-foreground"}`}
                            >
                                <User className="h-3.5 w-3.5" />
                                <span className="truncate w-full px-1">{selectedCustomer ? selectedCustomer.name.split(' ')[0] : "Cust"}</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-3 shadow-xl" align="center">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">Search Customer</Label>
                                    {selectedCustomer && (
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-5 px-1.5 text-[10px] text-destructive hover:bg-destructive/10"
                                            onClick={() => { setSelectedCustomer(null); setCustomerSearch("") }}
                                        >
                                            Clear
                                        </Button>
                                    )}
                                </div>
                                <div className="relative">
                                    <Input 
                                        placeholder="Name or email..." 
                                        value={customerSearch}
                                        onChange={(e) => {
                                            setCustomerSearch(e.target.value)
                                            if (!e.target.value) setIsCustomerSearchOpen(false)
                                        }}
                                        onFocus={() => customers.length > 0 && setIsCustomerSearchOpen(true)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                {isCustomerSearchOpen && customers.length > 0 && (
                                    <div className="border rounded-lg max-h-48 overflow-y-auto bg-background">
                                        {customers.map(c => (
                                            <div 
                                                key={c.id} 
                                                className="p-2.5 hover:bg-muted cursor-pointer text-xs border-b last:border-0 flex flex-col"
                                                onClick={() => {
                                                    setSelectedCustomer(c)
                                                    setCustomerSearch(c.name)
                                                    setIsCustomerSearchOpen(false)
                                                }}
                                            >
                                                <span className="font-semibold">{c.name}</span>
                                                <span className="text-[10px] opacity-60">{c.email}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Note Button */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className={`h-10 flex-col gap-0.5 px-0 text-[9px] font-bold transition-all ${orderNote ? "bg-orange-50 text-orange-600 border-orange-200" : "text-muted-foreground"}`}
                            >
                                <NotebookPen className="h-3.5 w-3.5" />
                                <span>Note</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-3 shadow-xl" align="center">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">Order Instructions</Label>
                                <textarea 
                                    className="w-full min-h-[80px] rounded-md border bg-background p-2 text-xs focus:ring-1 focus:ring-primary outline-none"
                                    placeholder="Add special instructions for this order..."
                                    value={orderNote}
                                    onChange={(e) => setOrderNote(e.target.value)}
                                />
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Discount Button */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className={`h-10 flex-col gap-0.5 px-0 text-[9px] font-bold transition-all ${discount > 0 ? "bg-green-50 text-green-600 border-green-200" : "text-muted-foreground"}`}
                            >
                                <Tag className="h-3.5 w-3.5" />
                                <span>{discount > 0 ? (discountType === 'percent' ? `-${discount}%` : "-IDR") : "Disc"}</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-3 shadow-xl" align="center">
                            <div className="space-y-3">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">Order Discount</Label>
                                <div className="flex rounded-lg border bg-background overflow-hidden shrink-0">
                                    <select 
                                        value={discountType} 
                                        onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")}
                                        className="bg-muted text-[10px] font-bold px-2 py-1 outline-none border-r w-12 appearance-none cursor-pointer"
                                    >
                                        <option value="percent">%</option>
                                        <option value="fixed">Rp</option>
                                    </select>
                                    <input 
                                        type="text" 
                                        inputMode="numeric"
                                        value={formatNumber(discount)} 
                                        onChange={(e) => setDiscount(parseNumber(e.target.value))}
                                        placeholder="0"
                                        className="w-full text-xs font-bold px-2 py-1.5 outline-none bg-transparent"
                                    />
                                </div>
                                {discount > 0 && (
                                     <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] text-destructive hover:bg-destructive/5" onClick={() => setDiscount(0)}>
                                        Remove Discount
                                     </Button>
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Tax Button */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className={`h-10 flex-col gap-0.5 px-0 text-[9px] font-bold transition-all ${taxRate > 0 ? "bg-blue-50 text-blue-600 border-blue-200" : "text-muted-foreground"}`}
                            >
                                <Percent className="h-3.5 w-3.5" />
                                <span>{taxRate > 0 ? `Tax ${taxRate}%` : "Tax"}</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-3 shadow-xl" align="center">
                            <div className="space-y-3">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">Tax Rate (%)</Label>
                                <div className="flex rounded-lg border bg-background overflow-hidden shrink-0">
                                    <div className="bg-muted text-[10px] font-bold px-2.5 py-1.5 border-r">FIX</div>
                                    <input 
                                        type="text" 
                                        inputMode="numeric"
                                        value={formatNumber(taxRate)} 
                                        onChange={(e) => setTaxRate(parseNumber(e.target.value))}
                                        placeholder="0"
                                        className="w-full text-xs font-bold px-2 py-1.5 outline-none bg-transparent"
                                    />
                                </div>
                                <p className="text-[9px] text-muted-foreground leading-tight">Tax will be applied to the subtotal after discount.</p>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Payment Method Selection */}
                <div className="space-y-2 pt-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">Payment Method</Label>
                    <div className="grid grid-cols-3 gap-2">
                    {[
                        { id: 'cash', label: 'Cash' },
                        { id: 'transfer', label: 'Transfer' },
                        { id: 'split', label: 'Split' }
                    ].map((method) => (
                        <button
                            key={method.id}
                            type="button"
                            onClick={() => setPaymentMethod(method.id as any)}
                            className={`flex items-center justify-center rounded-lg border py-2 text-[11px] font-bold transition-all ${
                                paymentMethod === method.id 
                                ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                                : "bg-background text-muted-foreground hover:bg-muted"
                            }`}
                        >
                            {method.label}
                        </button>
                    ))}
                    </div>
                </div>

                {/* Split Inputs Area */}
                {paymentMethod === 'split' && (
                    <div className="grid grid-cols-2 gap-3 mt-3 rounded-xl border bg-muted/20 p-3 shadow-inner">
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-medium">Cash</Label>
                            <Input
                                type="text"
                                inputMode="numeric"
                                value={formatNumber(splitCash)}
                                onChange={(e) => setSplitCash(parseNumber(e.target.value))}
                                className="h-8 text-xs font-bold"
                                placeholder="0"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-medium">Transfer</Label>
                            <Input
                                type="text"
                                inputMode="numeric"
                                value={formatNumber(splitTransfer)}
                                onChange={(e) => setSplitTransfer(parseNumber(e.target.value))}
                                className="h-8 text-xs font-bold"
                                placeholder="0"
                            />
                        </div>
                         <div className="col-span-2 text-[10px] flex justify-between border-t pt-2 mt-1">
                            <span className="font-medium text-muted-foreground">Paid:</span>
                            <span className={`font-bold ${(splitCash + splitTransfer) === total ? "text-green-600" : "text-destructive"}`}>
                                {formatIDR(splitCash + splitTransfer)}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <Separator />

          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px] uppercase font-medium text-muted-foreground tracking-wider">
              <span>Subtotal</span>
              <span>{formatIDR(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
                <div className="flex justify-between text-xs text-green-600 font-medium">
                  <span>Discount</span>
                  <span>-{formatIDR(discountAmount)}</span>
                </div>
            )}
            {tax > 0 && (
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                  <span>Tax ({taxRate}%)</span>
                  <span>{formatIDR(tax)}</span>
                </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-1 border-t mt-1">
              <span>Total</span>
              <span className="text-primary">{formatIDR(total)}</span>
            </div>
          </div>

          <Button 
            className="w-full h-12 text-sm font-bold uppercase tracking-widest transition-all" 
            size="lg" 
            onClick={handleCheckout} 
            disabled={cart.length === 0 || !isSplitValid || isCheckingOut}
          >
            {isCheckingOut ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                </>
            ) : (
                "Checkout Order"
            )}
          </Button>
        </div>
      </div>

      {/* Product Grid */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden min-h-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search Products"
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
                            : product.stock === 0 
                                ? <span className="text-destructive font-bold">Empty Stock</span>
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
                               <div className="text-xs text-muted-foreground">
                                   {variant.stock === 0 
                                       ? <span className="text-destructive font-bold">Empty Stock</span>
                                       : `Stock: ${variant.stock}`
                                   }
                               </div>
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
      {/* Receipt Dialog */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
          <DialogContent className="max-w-[450px]">
              <DialogHeader>
                  <DialogTitle>Receipt</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 items-center">
                  {/* Scrollable container for the receipt preview */}
                  <div className="max-h-[60vh] overflow-y-auto border p-2 bg-gray-100 w-full flex justify-center">
                    <Receipt order={lastOrder} ref={receiptRef} />
                  </div>
                  <div className="flex gap-2 w-full">
                      <PrintButton contentRef={receiptRef} className="flex-1" />
                      <Button variant="outline" onClick={handleDownloadReceipt} className="flex-1">
                          <Download className="mr-2 h-4 w-4" /> Download
                      </Button>
                  </div>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  )
}
