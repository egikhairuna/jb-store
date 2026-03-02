"use client"

import { useRef } from "react"
import { useBarcodeStore } from "@/lib/store/barcode-store"
import { BarcodeLabel } from "./label"
import { PrintButton } from "./print-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"

export function BarcodePreview() {
  const { items, clearAll } = useBarcodeStore()
  const printRef = useRef<HTMLDivElement>(null)

  const hasItems = items.length > 0
  const totalLabels = items.reduce((acc, item) => acc + item.quantity, 0)

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
         <div className="space-y-1">
             <h3 className="text-lg font-medium">Live Preview</h3>
             <p className="text-xs text-muted-foreground">Layout: 50mm x 30mm (2 Columns)</p>
         </div>
         <div className="flex gap-2">
            {hasItems && (
                <Button variant="destructive" size="sm" onClick={clearAll}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear All
                </Button>
            )}
            <PrintButton contentRef={printRef} />
         </div>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col shadow-none border bg-zinc-100/50">
        <CardContent className="flex-1 overflow-auto p-8 relative">
            {/* 
               Preview Area
               - Centered
               - Simulates the paper roll width (approx 100mm + gaps)
               - We use a fixed width container to simulate the roll
            */}
            
            <div className="min-h-full flex justify-center">
                <div 
                    ref={printRef} 
                    className="print-content bg-white shadow-sm  min-h-[30mm] w-fit"
                    style={{
                        // Width: 2 cols * 50mm = 100mm + minimal gap handling if needed
                        // But spec says "grid-template-columns: repeat(2, 50mm)"
                        width: '102mm', // slight buffer for visual separation if needed, but strict grid in inner div
                    }}
                >
                     {/* 
                        Strict Grid Layout 
                        - 2 columns of 50mm
                        - 30mm height
                        - No gaps between if continuous, or small gap if die-cut
                        - Spec: repeat(2, 50mm)
                     */}
                     <div 
                        className="grid"
                        style={{
                            gridTemplateColumns: 'repeat(2, 50mm)',
                            width: '105mm',
                            margin: '0 auto',
                            gap: '3.5mm'
                        }}
                     >
                        {items.map((item) => (
                            Array.from({ length: item.quantity }).map((_, i) => (
                                 <div 
                                    key={`${item.id}-${item.variantId}-${i}`} 
                                    className="w-[50mm] h-[30mm] overflow-hidden"
                                 >
                                     <div>
                                        <BarcodeLabel 
                                        name={item.variantName ? `${item.productName} - ${item.variantName}` : item.productName}
                                        sku={item.sku}
                                        price={item.price}
                                     />
                                     </div>
                                 </div>
                            ))
                        ))}
                     </div>
                     
                     {!hasItems && (
                         <div className="flex flex-col items-center justify-center p-8 text-muted-foreground h-full w-full">
                             <p>Preview area empty</p>
                         </div>
                     )}
                </div>
            </div>
        </CardContent>
            
        <div className="border-t bg-white p-2 text-center text-xs text-muted-foreground">
            Total Labels: {totalLabels}
        </div>
      </Card>
    </div>
  )
}
