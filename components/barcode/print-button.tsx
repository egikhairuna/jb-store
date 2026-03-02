"use client"

import { useReactToPrint } from "react-to-print"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PrintButtonProps {
  contentRef: React.RefObject<HTMLDivElement | null>
}

export function PrintButton({ contentRef }: PrintButtonProps) {
  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: "Barcode Labels",
    pageStyle: `
      @page {
        size: 100mm 30mm;
        margin: 0;
      }
      body {
        margin: 0;
        padding: 0;
      }
      @media print {
        html, body {
           height: auto;
           margin: 0 !important;
           padding: 0 !important;
           overflow: visible;
        }
        .print-page {
          page-break-after: always;
        }

        .print-page:last-child {
          page-break-after: auto;
        }
      }
    `
  })

  return (
    <Button onClick={() => handlePrint && handlePrint()}>
      <Printer className="mr-2 h-4 w-4" />
      Print Labels
    </Button>
  )
}
