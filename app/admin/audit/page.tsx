"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, RefreshCw, ChevronLeft, ChevronRight, FileJson } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export default function AuditLogPage() {
    const [logs, setLogs] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [search, setSearch] = useState("")
    const [currentPage, setCurrentPage] = useState(1)
    const [selectedLog, setSelectedLog] = useState<any>(null)
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)
    const limit = 50

    const fetchLogs = useCallback(async () => {
        setIsLoading(true)
        try {
            const offset = (currentPage - 1) * limit
            const resp = await fetch(`/api/admin/audit?limit=${limit}&offset=${offset}`)
            const json = await resp.json()
            if (json.success) {
                setLogs(json.data)
            }
        } catch (error) {
            console.error("Failed to fetch audit logs", error)
        } finally {
            setIsLoading(false)
        }
    }, [currentPage])

    useEffect(() => {
        fetchLogs()
    }, [fetchLogs])

    const filteredLogs = logs.filter(log => 
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
        log.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
        log.order?.posOrderId?.toLowerCase().includes(search.toLowerCase())
    )

    const getActionBadgeColor = (action: string) => {
        switch (action) {
            case 'ORDER_CREATED': return 'bg-green-100 text-green-700'
            case 'LOGIN': return 'bg-blue-100 text-blue-700'
            case 'SYNC_TRIGGERED': return 'bg-purple-100 text-purple-700'
            case 'DISCOUNT_APPLIED': return 'bg-orange-100 text-orange-700'
            default: return 'bg-gray-100 text-gray-700'
        }
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Audit Logs</h2>
                <Button variant="outline" onClick={fetchLogs} disabled={isLoading}>
                   <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                   Refresh
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>System Activity</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by action, user, or order ID..."
                            className="pl-8"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>User</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Target</TableHead>
                                    <TableHead className="text-right">Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-10">
                                            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                        </TableCell>
                                    </TableRow>
                                ) : filteredLogs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                            No logs found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredLogs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="text-xs whitespace-nowrap">
                                                {new Date(log.createdAt).toLocaleString()}
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium text-xs">{log.user?.name || 'Unknown'}</div>
                                                <div className="text-[10px] text-muted-foreground">{log.user?.email}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`text-[10px] ${getActionBadgeColor(log.action)} border-none`}>
                                                    {log.action}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {log.order?.posOrderId ? `#${log.order.posOrderId}` : '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8"
                                                    onClick={() => { setSelectedLog(log); setIsDetailsOpen(true); }}
                                                >
                                                    <FileJson className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex items-center justify-between pt-4">
                        <div className="text-xs text-muted-foreground">
                            Showing {filteredLogs.length} recent events
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Event Details</DialogTitle>
                    </DialogHeader>
                    {selectedLog && (
                        <div className="mt-2 text-xs font-mono bg-muted p-4 rounded-md overflow-x-auto">
                            <pre>{JSON.stringify(selectedLog.details, null, 2)}</pre>
                            <div className="mt-4 pt-4 border-t text-muted-foreground font-sans">
                                <div><strong>Log ID:</strong> {selectedLog.id}</div>
                                <div><strong>IP Address:</strong> {selectedLog.ipAddress || 'Not recorded'}</div>
                                <div><strong>User ID:</strong> {selectedLog.userId}</div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
