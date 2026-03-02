"use client"

import React, { useState } from "react"
import { Plus, Trash2, ChevronDown, ChevronUp, Edit, Image as ImageIcon, ChevronLeft, ChevronRight, MoreHorizontal, Loader2 } from "lucide-react"
import { useStore, Product, Variant, formatIDR } from "@/lib/store"
import { getProductVariants } from "@/app/actions/woocommerce"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function ProductsPage() {
  const { products, addProduct, removeProduct } = useStore()
  const [isOpen, setIsOpen] = useState(false)
  const [productType, setProductType] = useState<"simple" | "variable">("simple")
  const [isEditing, setIsEditing] = useState(false)
  const [currentProductId, setCurrentProductId] = useState<string | null>(null)
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: "",
    price: 0,
    stock: 0,
    sku: "",
    type: "simple",
    image: "",
  })
  const [variants, setVariants] = useState<Partial<Variant>[]>([])
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const handleAddVariant = () => {
    setVariants([...variants, { name: "", price: 0, stock: 0, sku: "" }])
  }

  const handleVariantChange = (index: number, field: keyof Variant, value: any) => {
    const newVariants = [...variants]
    newVariants[index] = { ...newVariants[index], [field]: value }
    
    // Auto-update SKU if name changes
    if (field === 'name') {
        newVariants[index].sku = `${newProduct.sku || ''} ${value}`
    }
    
    setVariants(newVariants)
  }

  const handleMainSkuChange = (value: string) => {
      setNewProduct({ ...newProduct, sku: value })
      // Update all variant SKUs
      if (productType === 'variable') {
          const updatedVariants = variants.map(v => ({
              ...v,
              sku: `${value} ${v.name || ''}`
          }))
          setVariants(updatedVariants)
      }
  }

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index))
  }

  const handleSaveProduct = () => {
    if (!newProduct.name) return

    const productData: Product = {
      id: isEditing && currentProductId ? currentProductId : Math.random().toString(36).substr(2, 9),
      name: newProduct.name,
      price: Number(newProduct.price || 0),
      stock: Number(newProduct.stock || 0),
      sku: newProduct.sku || "",
      type: productType,
      image: newProduct.image,
      variants: productType === "variable" ? variants.map(v => ({
          id: v.id || Math.random().toString(36).substr(2, 9),
          name: v.name || "",
          price: Number(v.price || 0),
          stock: Number(v.stock || 0),
          sku: v.sku || ""
      })) : undefined
    }

    if (isEditing && currentProductId) {
        // Reuse updateProduct from useStore which we need to make sure uses "updateProduct" properly
        // Actually store has addProduct and removeProduct, and updateProduct.
        // We need to fetch updateProduct from store destructuring.
        useStore.getState().updateProduct(currentProductId, productData)
    } else {
        useStore.getState().addProduct(productData)
    }

    setIsOpen(false)
    resetForm()
  }

  const resetForm = () => {
    setNewProduct({ name: "", price: 0, stock: 0, sku: "", type: "simple", image: "" })
    setVariants([])
    setProductType("simple")
    setIsEditing(false)
    setCurrentProductId(null)
  }

  const handleEditClick = (product: Product) => {
      setNewProduct({
          name: product.name,
          price: product.price,
          stock: product.stock,
          sku: product.sku,
          type: product.type,
          image: product.image
      })
      setProductType(product.type)
      setVariants(product.variants || [])
      setIsEditing(true)
      setCurrentProductId(product.id)
      setIsOpen(true)
  }

  const [isLoadingVariants, setIsLoadingVariants] = useState<Record<string, boolean>>({})
  const { setProductVariants } = useStore()

  const toggleExpand = async (id: string, product: Product) => {
      setExpandedProduct(expandedProduct === id ? null : id)
      
      if (expandedProduct !== id && product.type === 'variable') {
          // If expanding and no variants loaded, fetch them
          if (!product.variants || product.variants.length === 0) {
              setIsLoadingVariants(prev => ({ ...prev, [id]: true }))
              try {
                  const fetchedVariants = await getProductVariants(id)
                  setProductVariants(id, fetchedVariants)
              } catch (error) {
                  console.error("Failed to fetch variants", error)
              } finally {
                  setIsLoadingVariants(prev => ({ ...prev, [id]: false }))
              }
          }
      }
  }

  // Pagination Logic
  const totalProducts = products.length
  const totalPages = Math.ceil(totalProducts / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalProducts)
  const paginatedProducts = products.slice(startIndex, startIndex + pageSize)

  const getPageNumbers = () => {
    const pages = []
    const maxVisiblePages = 5

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

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Products</h2>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{isEditing ? "Edit Product" : "Add New Product"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">
                  Type
                </Label>
                <Select
                    value={productType}
                    onValueChange={(val: "simple" | "variable") => setProductType(val)}
                >
                    <SelectTrigger className="col-span-3">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="simple">Simple Product</SelectItem>
                        <SelectItem value="variable">Variable Product</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={newProduct.name}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, name: e.target.value })
                  }
                  className="col-span-3"
                />
              </div>

               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="image" className="text-right">
                  Image URL
                </Label>
                <div className="col-span-3 flex gap-2 items-center">
                    <Input
                    id="image"
                    value={newProduct.image || ""}
                    onChange={(e) =>
                        setNewProduct({ ...newProduct, image: e.target.value })
                    }
                    placeholder="https://..."
                    />
                     {newProduct.image && (
                         <img src={newProduct.image} alt="Preview" className="h-8 w-8 rounded object-cover border" />
                     )}
                </div>
              </div>

              {productType === "simple" ? (
                  <>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="price" className="text-right">
                        Price
                        </Label>
                        <Input
                        id="price"
                        type="number"
                        value={newProduct.price}
                        onChange={(e) =>
                            setNewProduct({ ...newProduct, price: Number(e.target.value) })
                        }
                        className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="stock" className="text-right">
                        Stock
                        </Label>
                        <Input
                        id="stock"
                        type="number"
                        value={newProduct.stock}
                        onChange={(e) =>
                            setNewProduct({ ...newProduct, stock: Number(e.target.value) })
                        }
                        className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="sku" className="text-right">
                        SKU
                        </Label>
                        <Input
                        id="sku"
                        value={newProduct.sku}
                        onChange={(e) =>
                            handleMainSkuChange(e.target.value)
                        }
                        className="col-span-3"
                        />
                    </div>
                  </>
              ) : (
                  <div className="col-span-4 space-y-4">
                       <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="main-sku" className="text-right">
                        Main SKU
                        </Label>
                        <Input
                        id="main-sku"
                         value={newProduct.sku}
                        onChange={(e) =>
                            handleMainSkuChange(e.target.value)
                        }
                        className="col-span-3"
                        />
                    </div>
                      <div className="flex justify-between items-center">
                          <Label>Variants</Label>
                          <Button type="button" variant="outline" size="sm" onClick={handleAddVariant}>
                              <Plus className="h-4 w-4 mr-2" /> Add Variant
                          </Button>
                      </div>
                      <ScrollArea className="h-[200px] border rounded-md p-4">
                          {variants.map((variant, index) => (
                              <div key={index} className="grid grid-cols-9 gap-2 mb-2 items-end">
                                  <div className="col-span-2">
                                      <Label className="text-xs">Name/Size</Label>
                                      <Input 
                                          value={variant.name} 
                                          onChange={(e) => handleVariantChange(index, 'name', e.target.value)} 
                                          placeholder="e.g. XL"
                                      />
                                  </div>
                                  <div className="col-span-2">
                                      <Label className="text-xs">Price</Label>
                                      <Input 
                                          type="number"
                                          value={variant.price} 
                                          onChange={(e) => handleVariantChange(index, 'price', Number(e.target.value))} 
                                      />
                                  </div>
                                  <div className="col-span-2">
                                      <Label className="text-xs">Stock</Label>
                                      <Input 
                                          type="number"
                                          value={variant.stock} 
                                          onChange={(e) => handleVariantChange(index, 'stock', Number(e.target.value))} 
                                      />
                                  </div>
                                  <div className="col-span-2">
                                      <Label className="text-xs">SKU</Label>
                                      <Input 
                                          value={variant.sku} 
                                          onChange={(e) => handleVariantChange(index, 'sku', e.target.value)} 
                                      />
                                  </div>
                                  <div className="col-span-1">
                                      <Button variant="ghost" size="icon" onClick={() => removeVariant(index)}>
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                  </div>
                              </div>
                          ))}
                      </ScrollArea>
                  </div>
              )}
            </div>
            <Button onClick={handleSaveProduct}>{isEditing ? "Save Changes" : "Save Product"}</Button>
          </DialogContent>
        </Dialog>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead className="w-[50px]">Image</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedProducts.map((product) => (
              <React.Fragment key={product.id}>
                <TableRow key={product.id}>
                  <TableCell>
                      {product.type === 'variable' && (
                          <Button variant="ghost" size="sm" onClick={() => toggleExpand(product.id, product)}>
                              {expandedProduct === product.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                      )}
                  </TableCell>
                  <TableCell>
                      {product.image ? (
                           <img src={product.image} alt={product.name} className="h-8 w-8 rounded object-cover" />
                      ) : (
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                              <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                      )}
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="capitalize">{product.type}</TableCell>
                  <TableCell>{product.type === 'simple' ? product.sku : '-'}</TableCell>
                  <TableCell>
                      {product.type === 'variable' 
                        ? (product.variants && product.variants.length > 0 
                            ? `${formatIDR(Math.min(...product.variants.map(v => v.price)))} - ${formatIDR(Math.max(...product.variants.map(v => v.price)))}`
                            : '-'
                          )
                        : formatIDR(product.price)
                      }
                  </TableCell>
                  <TableCell>
                      {product.type === 'variable' 
                          ? (product.variants ? product.variants.reduce((acc, v) => acc + v.stock, 0) : '-') 
                          : product.stock
                      }
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditClick(product)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeProduct(product.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
                {product.type === 'variable' && expandedProduct === product.id && (
                    <TableRow className="bg-muted/50">
                        <TableCell colSpan={8}>
                            <div className="p-4">
                                {isLoadingVariants[product.id] ? (
                                    <div className="flex justify-center py-4">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Variant</TableHead>
                                                <TableHead>SKU</TableHead>
                                                <TableHead>Price</TableHead>
                                                <TableHead>Stock</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {product.variants?.map((variant) => (
                                                <TableRow key={variant.id}>
                                                    <TableCell>{variant.name}</TableCell>
                                                    <TableCell>{variant.sku}</TableCell>
                                                    <TableCell>{formatIDR(variant.price)}</TableCell>
                                                    <TableCell>{variant.stock}</TableCell>
                                                </TableRow>
                                            ))}
                                            {(!product.variants || product.variants.length === 0) && (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                                                        No variants found or failed to load.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>
                        </TableCell>
                    </TableRow>
                )}
              </React.Fragment>
            ))}
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
            <span>Viewing {startIndex + 1} to {endIndex} of {totalProducts} records</span>
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
                disabled={currentPage === totalPages}
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
      </div>
    </div>
  )
}
