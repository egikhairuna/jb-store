import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Order, formatIDR } from "@/lib/store"
import { format } from "date-fns"

interface RecentSalesProps {
  orders: Order[]
}

export function RecentSales({ orders }: RecentSalesProps) {
  const colors = [
    "bg-red-500/10 text-red-600",
    "bg-blue-500/10 text-blue-600",
    "bg-green-500/10 text-green-600",
    "bg-orange-500/10 text-orange-600",
    "bg-purple-500/10 text-purple-600",
  ]

  return (
    <div className="space-y-4">
      {orders.length === 0 ? (
        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest text-center py-8">
          No transactions found
        </div>
      ) : (
        orders.map((order, index) => {
          const initials = order.id.substring(0, 2).toUpperCase()
          const colorClass = colors[index % colors.length]
          
          return (
            <div key={order.id} className="flex items-center p-3 rounded-lg hover:bg-muted/50 transition-colors group">
              <Avatar className="h-10 w-10 ring-2 ring-background">
                <AvatarFallback className={`font-black text-xs ${colorClass}`}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="ml-4 space-y-1">
                <p className="text-xs font-black leading-none group-hover:text-primary transition-colors">Order #{order.id}</p>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-70">
                        {order.paymentMethod}
                    </span>
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                    <span className="text-[9px] font-medium text-muted-foreground">
                        {format(new Date(order.date), "HH:mm, MMM dd")}
                    </span>
                </div>
              </div>
              <div className="ml-auto text-sm font-black tracking-tighter">
                {formatIDR(order.total)}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
