import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ProductType = 'simple' | 'variable'

export interface Variant {
  id: string
  name: string // e.g., "S", "M", "Red"
  price: number
  stock: number
  sku: string
}

export interface Product {
  id: string
  name: string
  price: number // Base price for simple products
  stock: number // Base stock for simple products
  sku: string // Base SKU for simple products
  type: ProductType
  variants?: Variant[]
  image?: string
}

export interface CartItem extends Product {
  quantity: number
  variantId?: string // If selected variant
  variantName?: string
}

export interface Order {
  id: string
  date: string
  items: CartItem[]
  total: number
  subtotal: number
  tax: number
  discount: number
  paymentMethod: string
  cashAmount?: number
  transferAmount?: number
  isPosOrder?: boolean
  posOrderId?: string
  syncStatus?: 'synced' | 'pending' | 'failed'
  cashierName?: string // Name of the logged-in cashier who created the order
}

interface AppState {
  products: Product[]
  cart: CartItem[]
  orders: Order[]
  wcOrders: Order[]
  addProduct: (product: Product) => void
  removeProduct: (id: string) => void
  updateProduct: (id: string, updates: Partial<Product>) => void
  addToCart: (product: Product, variantId?: string) => void
  removeFromCart: (id: string, variantId?: string) => void
  updateCartQuantity: (id: string, variantId: string | undefined, quantity: number) => void
  clearCart: () => void
  addOrder: (order: Order) => void
  removeOrder: (id: string) => void
  setOrders: (orders: Order[]) => void
  setProducts: (products: Product[]) => void
  setProductVariants: (productId: string, variants: Variant[]) => void
  setWCOrders: (orders: Order[] | ((prev: Order[]) => Order[])) => void
  batchUpdateInventory: (updates: { id: string; variantId?: string; quantity: number }[]) => void
}

export const formatIDR = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export const formatNumber = (value: number | string): string => {
  if (value === undefined || value === null || value === '') return ''
  const num = typeof value === 'string' ? parseInt(value.replace(/\D/g, ''), 10) : value
  if (isNaN(num)) return ''
  return new Intl.NumberFormat('id-ID').format(num)
}

export const parseNumber = (value: string): number => {
  if (!value) return 0
  const clean = value.replace(/\D/g, '')
  return clean ? parseInt(clean, 10) : 0
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      products: [
        { id: '1', name: 'Coffee', price: 15000, stock: 100, sku: 'COF-001', type: 'simple' },
        { id: '2', name: 'Tea', price: 10000, stock: 50, sku: 'TEA-001', type: 'simple' },
        { 
            id: '3', 
            name: 'Jacket', 
            price: 0, 
            stock: 0, 
            sku: 'JCK-001', 
            type: 'variable',
            variants: [
                { id: 'v1', name: 'S', price: 250000, stock: 10, sku: 'JCK-S' },
                { id: 'v2', name: 'M', price: 250000, stock: 15, sku: 'JCK-M' },
                { id: 'v3', name: 'L', price: 260000, stock: 5, sku: 'JCK-L' },
            ]
        },
      ],
      cart: [],
      orders: [],
      wcOrders: [],
      addProduct: (product) =>
        set((state) => ({ products: [...state.products, product] })),
      removeProduct: (id) =>
        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
        })),
      updateProduct: (id, updates) =>
        set((state) => ({
          products: state.products.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),
      addToCart: (product, variantId) =>
        set((state) => {
          const cartId = variantId ? `${product.id}-${variantId}` : product.id
          const existing = state.cart.find((item) => {
              const itemCartId = item.variantId ? `${item.id}-${item.variantId}` : item.id
              return itemCartId === cartId
          })

          if (existing) {
            return {
              cart: state.cart.map((item) => {
                  const itemCartId = item.variantId ? `${item.id}-${item.variantId}` : item.id
                  return itemCartId === cartId
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
              }),
            }
          }

          let itemToAdd: CartItem = { ...product, quantity: 1 }
          
          if (variantId && product.variants) {
              const variant = product.variants.find(v => v.id === variantId)
              if (variant) {
                  itemToAdd = {
                      ...itemToAdd,
                      price: variant.price,
                      sku: variant.sku,
                      variantId: variant.id,
                      variantName: variant.name,
                      stock: variant.stock // Use variant stock
                  }
              }
          }

          return { cart: [...state.cart, itemToAdd] }
        }),
      removeFromCart: (id, variantId) =>
        set((state) => ({
          cart: state.cart.filter((item) => {
              if (variantId) return !(item.id === id && item.variantId === variantId)
              return item.id !== id
          }),
        })),
      updateCartQuantity: (id, variantId, quantity) =>
        set((state) => ({
          cart: state.cart.map((item) => {
              const match = variantId ? (item.id === id && item.variantId === variantId) : (item.id === id && !item.variantId)
              return match ? { ...item, quantity } : item
          }),
        })),
      clearCart: () => set({ cart: [] }),
      addOrder: (order) => set((state) => ({ orders: [order, ...state.orders] })),
      removeOrder: (id) => set((state) => ({ orders: state.orders.filter((o) => o.id !== id) })),
      setOrders: (orders) => set({ orders }),
      setProducts: (products) => set({ products }),
      setWCOrders: (orders) => 
        set((state) => ({ 
            wcOrders: typeof orders === 'function' ? orders(state.wcOrders) : orders 
        })),
      setProductVariants: (productId, variants) => 
        set((state) => ({
          products: state.products.map(p => 
            p.id === productId ? { ...p, variants } : p
          )
        })),
      batchUpdateInventory: (updates) =>
        set((state) => ({
          products: state.products.map((p) => {
            const productUpdates = updates.filter((u) => u.id === p.id)
            if (productUpdates.length === 0) return p

            let updatedProduct = { ...p }
            productUpdates.forEach((update) => {
              if (update.variantId && updatedProduct.variants) {
                updatedProduct.variants = updatedProduct.variants.map((v) =>
                  v.id === update.variantId ? { ...v, stock: v.stock - update.quantity } : v
                )
              } else if (!update.variantId) {
                updatedProduct.stock -= update.quantity
              }
            })
            return updatedProduct
          }),
        })),
    }),
    {
      name: 'pos-storage-v2', // Changed name to reset storage for new schema
    }
  )
)
