import { create } from 'zustand'

export interface BarcodeItem {
  id: string // product id
  variantId?: string
  productName: string
  variantName?: string
  sku: string
  price: number
  quantity: number
}

interface BarcodeState {
  items: BarcodeItem[]
  addItem: (item: BarcodeItem) => void
  updateQuantity: (index: number, quantity: number) => void
  removeItem: (index: number) => void
  clearAll: () => void
}

export const useBarcodeStore = create<BarcodeState>((set) => ({
  items: [],
  addItem: (newItem) => set((state) => {
    // Check if exact item exists to merge quantity
    const existingIndex = state.items.findIndex(
      (item) => item.id === newItem.id && item.variantId === newItem.variantId
    )

    if (existingIndex !== -1) {
      const updatedItems = [...state.items]
      updatedItems[existingIndex].quantity += newItem.quantity
      return { items: updatedItems }
    }

    return { items: [...state.items, newItem] }
  }),
  updateQuantity: (index, quantity) => set((state) => {
    if (quantity < 1) return state
    const updatedItems = [...state.items]
    updatedItems[index].quantity = quantity
    return { items: updatedItems }
  }),
  removeItem: (index) => set((state) => ({
    items: state.items.filter((_, i) => i !== index)
  })),
  clearAll: () => set({ items: [] }),
}))
