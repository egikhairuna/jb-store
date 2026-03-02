"use client"

import { useState, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, ShoppingCart, Package, Barcode, Warehouse, FileText, RefreshCw, ClipboardList, Loader2, Sun, Moon, LogOut, Users, User, Settings, Bell } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/store"
import { useTheme } from "@/lib/hooks/use-theme"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const sidebarItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Cashier", href: "/pos", icon: ShoppingCart },
  { name: "Products", href: "/products", icon: Package },
  { name: "Orders", href: "/orders", icon: ClipboardList },
  { name: "Barcode", href: "/barcode", icon: Barcode },
  { name: "Inventory", href: "/inventory", icon: Warehouse },
  { name: "Reports", href: "/reports", icon: FileText },
]

const adminOnlyItems = [
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Audit Log", href: "/admin/audit", icon: FileText },
]

export function Sidebar() {
  const { data: session } = useSession()
  const userName = session?.user?.name ?? session?.user?.email ?? "Staff"
  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()
  const [time, setTime] = useState(new Date())
  const [mounted, setMounted] = useState(false)
  const setProducts = useStore((state) => state.setProducts)
  const setWCOrders = useStore((state) => state.setWCOrders)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)

  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleSyncAll = async () => {
    setIsSyncing(true)
    setSyncStatus('idle')

    try {
      // Sync products
      const productsRes = await fetch('/api/sync/products', { method: 'POST' })
      const productsData = await productsRes.json()
      
      if (productsData.success && productsData.data) {
        setProducts(productsData.data)
      }

      // Sync orders
      const ordersRes = await fetch('/api/sync/orders', { method: 'POST' })
      const ordersData = await ordersRes.json()
      
      if (ordersData.success && ordersData.data) {
        setWCOrders(ordersData.data)
      }

      setSyncStatus('success')
      setLastSyncTime(new Date())
    } catch (error) {
      console.error('Sync failed:', error)
      setSyncStatus('error')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card text-card-foreground shadow-sm">
      {/* Sidebar Header */}
      <div className="flex h-16 items-center justify-between px-6 border-b">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black text-lg shadow-sm group-hover:scale-105 transition-transform">
            JB
          </div>
          <span className="font-bold text-base tracking-tight uppercase">Store</span>
        </Link>
        <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md text-muted-foreground hover:text-primary transition-colors"
              onClick={toggleTheme}
              title="Toggle Theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-md text-muted-foreground hover:text-primary transition-colors" 
              onClick={handleSyncAll} 
              disabled={isSyncing}
              title="Sync All Data"
            >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <RefreshCw className={cn(
                    "h-4 w-4",
                    syncStatus === 'success' && "text-green-500",
                    syncStatus === 'error' && "text-red-500"
                  )} />
                )}
            </Button>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-hide">
        <nav className="space-y-1">
          <div className="px-2 mb-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
            Main Menu
          </div>
          {sidebarItems.map((item, index) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={index}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary shadow-[0_0_15px_rgba(var(--primary),0.1)]"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {isActive && (
                    <div className="absolute left-0 w-1 h-5 bg-primary rounded-full -translate-x-1" />
                )}
                <item.icon className={cn(
                    "h-5 w-5 transition-transform group-hover:scale-110",
                    isActive ? "text-primary" : "text-muted-foreground/70"
                )} />
                {item.name}
              </Link>
            )
          })}

          {/* Admin-only section */}
          {session?.user?.role === "ADMIN" && (
            <div className="pt-6">
              <div className="px-2 mb-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                Administration
              </div>
              {adminOnlyItems.map((item, index) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={index}
                    href={item.href}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200",
                      isActive
                        ? "bg-primary/10 text-primary shadow-[0_0_15px_rgba(var(--primary),0.1)]"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {isActive && (
                        <div className="absolute left-0 w-1 h-5 bg-primary rounded-full -translate-x-1" />
                    )}
                    <item.icon className={cn(
                        "h-5 w-5 transition-transform group-hover:scale-110",
                        isActive ? "text-primary" : "text-muted-foreground/70"
                    )} />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          )}
        </nav>
      </div>

      {/* Sidebar Footer: User Profile Card */}
      <div className="mt-auto p-4 border-t bg-muted/20">
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 bg-background border rounded-2xl p-3 shadow-sm">
                <Avatar className="h-10 w-10 border shadow-inner shrink-0">
                    <AvatarImage src={session?.user?.image || ""} alt={userName} />
                    <AvatarFallback className="bg-primary/5 text-primary font-black text-xs">
                        {userInitials}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                        <p className="text-xs font-bold leading-tight">{userName}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 tabular-nums font-medium">
                        {mounted ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        {lastSyncTime && (
                           <span className="ml-1 opacity-60">• Synced</span>
                        )}
                    </p>
                </div>
            </div>

            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 rounded-xl text-[10px] font-bold gap-2 text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                >
                    <LogOut className="h-3.5 w-3.5" />
                    Logout
                </Button>
                {lastSyncTime && (
                    <div className="flex items-center gap-1.5 px-3 bg-green-500/5 border border-green-500/10 rounded-xl">
                        <div className="h-1 w-1 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-green-600/80 uppercase">Live</span>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  )
}
