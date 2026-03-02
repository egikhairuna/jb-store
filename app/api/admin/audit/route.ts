import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

/**
 * API for System Audit Logs
 * GET: Fetch all audit logs (ADMIN only)
 */

export async function GET(req: Request) {
  try {
    // 🔒 Strictly ADMIN only for audit logs
    await requireRole(["ADMIN"]);
    
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const auditLogs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true
          }
        },
        order: {
          select: {
            posOrderId: true,
            total: true
          }
        }
      }
    });

    // Parse details JSON
    const parsedLogs = auditLogs.map(log => ({
      ...log,
      details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details
    }));

    return NextResponse.json({
      success: true,
      data: parsedLogs
    });

  } catch (error: any) {
    console.error("[API] Audit Log fetch error:", error);
    
    if (error instanceof Response) return error;

    return NextResponse.json(
      { 
        success: false, 
        error: error.message || "Internal server error" 
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
