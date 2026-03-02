import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Internal DB health check endpoint.
 * Verifies SQLite connectivity and confirms WAL mode is active.
 *
 * Usage:  GET /api/health/db
 * OK:     { "status": "ok",       "journal_mode": "wal",    "wal_mode_active": true }
 * WARN:   { "status": "degraded", "journal_mode": "delete", "wal_mode_active": false }
 * ERROR:  { "status": "error",    "db_reachable": false }
 *
 * In production: expose only to internal IPs via Nginx or add a static
 * HEALTH_SECRET header check to prevent public enumeration.
 */

export async function GET() {
  try {
    const [, journalModeResult] = await Promise.all([
      // Connectivity check — if this throws, the catch block handles it
      prisma.$queryRaw<[{ ok: number }]>`SELECT 1 AS ok`,
      // WAL mode check
      prisma.$queryRaw<[{ journal_mode: string }]>`PRAGMA journal_mode`,
    ]);

    const journalMode = (journalModeResult as [{ journal_mode: string }])[0]
      ?.journal_mode;
    const isWal = journalMode === "wal";

    return NextResponse.json(
      {
        status: isWal ? "ok" : "degraded",
        db_reachable: true,
        journal_mode: journalMode,
        wal_mode_active: isWal,
        checked_at: new Date().toISOString(),
      },
      { status: isWal ? 200 : 500 }
    );
  } catch (error: any) {
    console.error("[Health] DB check failed:", error.message);

    return NextResponse.json(
      {
        status: "error",
        db_reachable: false,
        error: error.message,
        checked_at: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Never cache a health check — always hit the live DB
export const dynamic = "force-dynamic";
