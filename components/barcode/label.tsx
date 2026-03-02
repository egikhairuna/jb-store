import { BarcodeSvg } from "./barcode-svg"
import { formatIDR } from "@/lib/store"

interface BarcodeLabelProps {
  name: string
  sku: string
  price: number
}

// Fixed dimensions: 50mm x 30mm
// Print CSS handles the actual physical size
export function BarcodeLabel({ name, sku, price }: BarcodeLabelProps) {
  return (
    <div className="flex flex-col items-center justify-center p-1 w-[50mm] h-[30mm] bg-white text-black overflow-hidden box-border mx-auto border border-gray-200 print:border-none print:break-inside-avoid">
       {/* Product Name: 8px Semi-Bold */}
       <div className="w-full text-center px-1">
          <p className="text-[10px] font-medium leading-tight break-words line-clamp-2">
            {name}
          </p>
       </div>

       {/* Barcode: Code 128 */}
       <div className="flex justify-center w-full my-[1px]">
          <BarcodeSvg 
            value={sku} 
            height={70} 
            width={1.1} // Slightly adjusted width for better fit
            className="h-auto max-w-full"
          />
       </div>

       <div className="flex justify-between w-full my-[1px] items-start">
          {/* SKU: 8px Semi-Bold */}
          <p className="text-[10px] font-normal text-center leading-none mt-[1px]">
             {sku}
          </p>

          {/* Price: 10px Bold */}
          <p className="text-[12px] font-bold text-center leading-tight mt-[1px]">
            {formatIDR(price)}
          </p>
       </div>
    </div>
  )
}
