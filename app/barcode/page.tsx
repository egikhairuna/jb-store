"use client"

import { BarcodeSidebar } from "@/components/barcode/sidebar"
import { BarcodePreview } from "@/components/barcode/preview"

export default function BarcodePage() {
  return (
    <div className="h-[calc(100vh-64px)] grid grid-cols-1 md:grid-cols-12 overflow-hidden">
        {/* Left Sidebar: Product Selection */}
        <div className="h-full md:col-span-4 lg:col-span-3 border-r overflow-hidden">
            <BarcodeSidebar />
        </div>

        {/* Right Content: Preview & Print */}
        <div className="h-full md:col-span-8 lg:col-span-9 p-6 overflow-hidden bg-background">
            <BarcodePreview />
        </div>
    </div>
  )
}
