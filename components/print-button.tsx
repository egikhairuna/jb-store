
import React from 'react';
import { useReactToPrint } from 'react-to-print';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface PrintButtonProps {
  contentRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

export const PrintButton: React.FC<PrintButtonProps> = ({ contentRef, className }) => {
  const pageStyle = `
    @page {
      size: 80mm auto;
      margin: 0;
    }
  `;

  const handlePrint = useReactToPrint({
    contentRef: contentRef,
    documentTitle: 'Receipt',
    pageStyle: pageStyle,
    onAfterPrint: () => console.log('Print completed'),
  });

  return (
    <Button onClick={() => handlePrint()} className={className}>
      <Printer className="mr-2 h-4 w-4" />
      Print Receipt
    </Button>
  );
};
