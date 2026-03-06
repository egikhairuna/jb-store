import React, { forwardRef } from 'react';
import { Courier_Prime } from 'next/font/google';
import Barcode from 'react-barcode';
import { Order, formatIDR } from '@/lib/store';

const courierPrime = Courier_Prime({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-courier-prime',
});

interface ReceiptProps {
  order: Order | null;
}

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(({ order }, ref) => {
  if (!order) return null;

  return (
    <div className={`receipt-80mm ${courierPrime.variable}`} ref={ref}>
      <div className="receipt-header">
           {/* Logo - assuming absolute path or public folder */}
          <img src="/brand-logo.png" alt="Logo" className="receipt-logo" />
          <div className="store-address">Jl. Gambir Saketi No. 44</div>
          <div className="store-city">Bandung, 40123</div>
          <div className="store-contact">Tel: +62 8515 7000 263</div>
      </div>
      
      <div className="receipt-divider"></div>
      
      <div className="receipt-info">
          <div>Date: {new Date(order.date).toLocaleDateString()}</div>
          <div>
              Time: {new Date(order.date).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              })}
          </div>
          <div>Order ID: {order.id}</div>
          {order.cashierName && order.cashierName.trim() !== "" && (
            <div className="uppercase">Cashier: {order.cashierName}</div>
          )}
      </div>



      <div className="receipt-divider"></div>
      
      <div className="receipt-items">
          {order.items.map((item: any, index: number) => (
              <div key={index} className="receipt-item">
                  <div className="item-name">
                    {item.name} {item.variantName ? `(${item.variantName})` : ''} 
                    <span className="item-qty"> x{item.quantity}</span>
                  </div>
                  <div className="item-price">{formatIDR(item.price * item.quantity)}</div>
              </div>
          ))}
      </div>

      <div className="receipt-divider"></div>
      
      <div className="receipt-totals">
          <div className="line-item">
              <span>Subtotal</span>
              <span>{formatIDR(order.subtotal)}</span>
          </div>
          {order.discount > 0 && (
            <div className="line-item">
                <span>Discount</span>
                <span>-{formatIDR(order.discount)}</span>
            </div>
          )}
          {order.tax > 0 && (
              <div className="line-item">
                  <span>Tax</span>
                  <span>{formatIDR(order.tax)}</span>
              </div>
          )}
          <div className="line-item">
              <span>Payment Method</span>
              <span className="capitalize">{order.paymentMethod === 'split' ? 'Split Bill' : order.paymentMethod}</span>
          </div>
          {order.paymentMethod === 'split' && (
            <div className="receipt-split-details">
                <div className="line-item">
                    <span>- Cash</span>
                    <span>{formatIDR(order.cashAmount || 0)}</span>
                </div>
                <div className="line-item">
                    <span>- Transfer</span>
                    <span>{formatIDR(order.transferAmount || 0)}</span>
                </div>
            </div>
          )}
          <div className="line-item grand-total">
              <span>Total</span>
              <span>{formatIDR(order.total)}</span>
          </div>
      </div>

      <div className="receipt-divider"></div>
      
      {order.paymentMethod === 'cash' && order.cashAmount && (
           <div className="receipt-payment">
               <div className="line-item">
                   <span>Cash</span>
                   <span>{formatIDR(order.cashAmount)}</span>
               </div>
               <div className="line-item">
                   <span>Change</span>
                   <span>{formatIDR(order.cashAmount - order.total)}</span>
               </div>
           </div>
       )}
       
      <div className="receipt-footer flex flex-col items-center">
          <p className="mb-2">Thank you!</p>
          <div className="flex justify-center w-full overflow-hidden">
            <Barcode 
              value={order.id} 
              width={1.5}
              height={40}
              fontSize={12}
              displayValue={true}
              margin={0}
            />
          </div>
      </div>
    </div>
  );
});

Receipt.displayName = 'Receipt';
