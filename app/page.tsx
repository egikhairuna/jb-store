"use client"

import { useEffect, useState } from "react"
import { CreditCard, DollarSign, Package, Users, TrendingUp } from "lucide-react"
import { useStore, formatIDR, Order } from "@/lib/store"
import { 
  format, 
  startOfDay, 
  endOfDay, 
  startOfMonth, 
  endOfMonth, 
  isWithinInterval, 
  subDays,
  eachDayOfInterval,
  isSameDay
} from "date-fns"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Overview } from "@/components/dashboard/overview"
import { RecentSales } from "@/components/dashboard/recent-sales"

export default function DashboardPage() {
  const { orders: localOrders, wcOrders } = useStore()
  const [isLoading, setIsLoading] = useState(false)

  // Merge local and remote orders (logic from ReportsPage)
  const localOrderIds = new Set(localOrders.map(o => o.id))
  const uniqueRemoteOrders = wcOrders.filter(o => {
    // Deduplicate: If we already have this order ID locally
    if (localOrderIds.has(o.id)) return false

    if (o.isPosOrder && o.posOrderId) {
      return !localOrderIds.has(o.posOrderId)
    }
    return true
  })
  
  const allOrders = [...localOrders, ...uniqueRemoteOrders].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  // Calculations
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const revenueToday = allOrders
    .filter(order => isWithinInterval(new Date(order.date), { start: todayStart, end: todayEnd }))
    .reduce((sum, order) => sum + order.total, 0)

  const revenueMonth = allOrders
    .filter(order => isWithinInterval(new Date(order.date), { start: monthStart, end: monthEnd }))
    .reduce((sum, order) => sum + order.total, 0)

  const totalSalesCount = allOrders
    .filter(order => isWithinInterval(new Date(order.date), { start: monthStart, end: monthEnd }))
    .length

  // Recent Orders (top 5)
  const recentOrders = allOrders.slice(0, 5)

  // Chart Data (Last 7 Days)
  const last7Days = eachDayOfInterval({
    start: subDays(now, 6),
    end: now
  })

  const chartData = last7Days.map(day => {
    const dayTotal = allOrders
      .filter(order => isSameDay(new Date(order.date), day))
      .reduce((sum, order) => sum + order.total, 0)
    
    return {
      name: format(day, "MMM dd"),
      total: dayTotal
    }
  })

  return (
    <div className="flex-1 space-y-8 p-8 pt-6 relative overflow-hidden bg-slate-50/50 dark:bg-slate-950/50">
      {/* Decorative Gradient Blobs */}
      <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />

      <div className="flex items-center justify-between space-y-2 relative z-10">
        <div>
          <h2 className="text-4xl font-black tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">Welcome back. Here's what's happening today.</p>
        </div>
      </div>
      <div className="space-y-4">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 relative z-10">
          <Card className="border-none bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-sm hover:shadow-md transition-all duration-300 ring-1 ring-black/5 dark:ring-white/10 group overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
              <DollarSign className="h-24 w-24 -mr-4 -mt-4 rotate-12" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                Total Revenue Today
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black tracking-tighter">{formatIDR(revenueToday)}</div>
              <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 mt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                Live from store
              </p>
            </CardContent>
          </Card>

          <Card className="border-none bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-sm hover:shadow-md transition-all duration-300 ring-1 ring-black/5 dark:ring-white/10 group overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
              <TrendingUp className="h-24 w-24 -mr-4 -mt-4 rotate-12" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                Revenue This Month
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black tracking-tighter">{formatIDR(revenueMonth)}</div>
              <p className="text-[10px] text-muted-foreground font-medium mt-1">
                Aggregated month-to-date
              </p>
            </CardContent>
          </Card>

          <Card className="border-none bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-sm hover:shadow-md transition-all duration-300 ring-1 ring-black/5 dark:ring-white/10 group overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
              <CreditCard className="h-24 w-24 -mr-4 -mt-4 rotate-12" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Monthly Sales</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-orange-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black tracking-tighter">+{totalSalesCount}</div>
              <p className="text-[10px] text-muted-foreground font-medium mt-1">
                Total completed orders
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7 relative z-10">
          <Card className="col-span-4 border-none bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-sm ring-1 ring-black/5 dark:ring-white/10">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Sales Overview</CardTitle>
              <p className="text-[10px] text-muted-foreground -mt-1 font-medium">Last 7 days revenue performance</p>
            </CardHeader>
            <CardContent className="pl-2">
              <Overview data={chartData} />
            </CardContent>
          </Card>
          <Card className="col-span-3 border-none bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-sm ring-1 ring-black/5 dark:ring-white/10">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Recent Orders</CardTitle>
              <CardDescription className="text-[10px] font-medium uppercase mt-0.5">
                Latest live transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecentSales orders={recentOrders} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
