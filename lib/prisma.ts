import { PrismaClient } from "@prisma/client";

/**
 * Global Prisma singleton for Next.js.
 *
 * In development, Next.js hot-reload creates new module instances on every
 * file change. Without this singleton pattern, each reload spawns a new
 * PrismaClient connection pool, quickly exhausting SQLite's connection limit.
 *
 * In production (single startup), this is just a normal singleton.
 *
 * SQLite PRAGMAs applied on every new connection:
 * - journal_mode = WAL        → reader/writer non-blocking (critical)
 * - synchronous = NORMAL      → safe durability with WAL, faster than FULL
 * - busy_timeout = 5000       → retry for 5s on SQLITE_BUSY before throwing
 * - foreign_keys = ON         → required for onDelete:Cascade to work
 * - cache_size = -32000       → 32 MB in-process page cache
 * - mmap_size = 134217728     → 128 MB memory-mapped I/O
 * - wal_autocheckpoint = 1000 → checkpoint WAL every 1000 pages
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function makePrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

  const pragmas = [
    "PRAGMA journal_mode = WAL",
    "PRAGMA synchronous = NORMAL",
    "PRAGMA busy_timeout = 5000",
    "PRAGMA foreign_keys = ON",
    "PRAGMA cache_size = -32000",
    "PRAGMA mmap_size = 134217728",
    "PRAGMA wal_autocheckpoint = 1000",
  ];

  for (const pragma of pragmas) {
    client.$executeRawUnsafe(pragma).catch((e) =>
      console.error(`[Prisma] Failed to apply PRAGMA "${pragma}": ${e.message}`)
    );
  }

  return client;
}

export const prisma = globalForPrisma.prisma ?? makePrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
