import { prisma } from "@/lib/prisma";

/**
 * Global Sync Lock Service
 * Prevents concurrent WooCommerce sync operations
 * Database-backed for multi-process safety
 *
 * Uses a single atomic SQL UPDATE to avoid TOCTOU (time-of-check/time-of-use)
 * race conditions. The previous two-step findUnique → update had a window where
 * two concurrent callers could both observe the lock as free and both proceed.
 * A single UPDATE WHERE is atomic at the SQLite level — only one caller wins.
 */

class SyncLockService {
  private readonly LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  private readonly COOLDOWN_MS = 30 * 1000; // 30 seconds between syncs

  /**
   * Attempt to acquire a lock for a specific sync type.
   *
   * Strategy:
   * 1. Ensure the lock row exists (upsert, idempotent)
   * 2. Single atomic UPDATE WHERE — only succeeds if lock is free + past
   *    cooldown, OR if the existing lock is stale (past timeout)
   * 3. If rowsAffected === 0, read current state for a diagnostic message
   */
  async acquireLock(
    syncType: string
  ): Promise<{ success: boolean; syncId?: string; message?: string }> {
    const now = new Date();
    const timeoutThreshold = new Date(now.getTime() - this.LOCK_TIMEOUT_MS).toISOString();
    const cooldownThreshold = new Date(now.getTime() - this.COOLDOWN_MS).toISOString();
    const syncId = this.generateSyncId();

    // Ensure the lock row exists before attempting the atomic update
    await prisma.syncLock.upsert({
      where: { id: syncType },
      update: {},
      create: { id: syncType, isLocked: false },
    });

    // Single atomic UPDATE: SQLite processes this as one indivisible operation.
    // rowsAffected = 1 → we won the lock.
    // rowsAffected = 0 → the lock is held or cooldown is still active.
    const rowsAffected = await prisma.$executeRaw`
      UPDATE "SyncLock"
      SET
        "isLocked"  = 1,
        "syncId"    = ${syncId},
        "lockedAt"  = ${now.toISOString()},
        "updatedAt" = ${now.toISOString()}
      WHERE
        "id" = ${syncType}
        AND (
          ("isLocked" = 0 AND "updatedAt" < ${cooldownThreshold})
          OR ("updatedAt" < ${timeoutThreshold})
        )
    `;

    if ((rowsAffected as number) === 1) {
      console.log(`[SyncLock] Lock acquired for ${syncType} (ID: ${syncId})`);
      return { success: true, syncId };
    }

    // Lock not acquired — read current state to return a useful diagnostic message.
    // This read is safe post-rejection: it's for messaging only, not for decision-making.
    const current = await prisma.syncLock.findUnique({ where: { id: syncType } });

    if (current?.isLocked) {
      const lockAge = now.getTime() - current.updatedAt.getTime();
      const timeRemaining = Math.ceil((this.LOCK_TIMEOUT_MS - lockAge) / 1000);
      return {
        success: false,
        message: `Sync already in progress (ID: ${current.syncId}). Started ${Math.floor(
          lockAge / 1000
        )}s ago. Max wait: ${timeRemaining}s.`,
      };
    }

    const cooldownAge = now.getTime() - (current?.updatedAt?.getTime() ?? 0);
    const cooldownRemaining = Math.ceil((this.COOLDOWN_MS - cooldownAge) / 1000);
    return {
      success: false,
      message: `Cooldown active. Last sync completed ${Math.floor(
        cooldownAge / 1000
      )}s ago. Wait ${cooldownRemaining}s.`,
    };
  }

  /**
   * Release a lock after sync completion.
   * Scoped to syncId to prevent accidentally releasing a lock we don't own
   * (e.g., if a stale-lock takeover happened while this sync was running).
   */
  async releaseLock(syncType: string, syncId: string): Promise<void> {
    try {
      await prisma.syncLock.update({
        where: { id: syncType, syncId: syncId },
        data: { isLocked: false, syncId: null, updatedAt: new Date() },
      });
      console.log(`[SyncLock] Lock released for ${syncType} (ID: ${syncId})`);
    } catch {
      console.warn(
        `[SyncLock] Failed to release lock for ${syncType} (ID: ${syncId}): Already released or expired.`
      );
    }
  }

  /**
   * Force release a lock (admin use only, e.g., after a crashed sync).
   */
  async forceRelease(syncType: string): Promise<void> {
    await prisma.syncLock.update({
      where: { id: syncType },
      data: { isLocked: false, syncId: null, updatedAt: new Date() },
    });
    console.warn(`[SyncLock] Force released lock for ${syncType}`);
  }

  private generateSyncId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

export const syncLockService = new SyncLockService();
