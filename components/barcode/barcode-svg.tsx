"use client"

import { useEffect, useRef } from "react"
import JsBarcode from "jsbarcode"

interface BarcodeSvgProps {
  value: string
  width?: number
  height?: number
  className?: string
}

export function BarcodeSvg({ value, width = 1.2, height = 30, className }: BarcodeSvgProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, value, {
          format: "CODE128",
          width: width,
          height: height,
          displayValue: false,
          margin: 0,
          background: "transparent",
        })
      } catch (e) {
        console.error("Barcode generation failed", e)
      }
    }
  }, [value, width, height])

  return <svg ref={svgRef} className={className} />
}
