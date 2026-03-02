/**
 * Shared Sync Utilities
 * Exponential backoff and specialized fetchers
 */

export async function fetchWithExponentialBackoff<T>(
  operationName: string,
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries <= 1) {
      console.error(`[SyncUtils] ${operationName} failed after all retries: ${error.message}`);
      throw error;
    }

    console.warn(
      `[SyncUtils] ${operationName} error: ${error.message}. Retrying in ${delay}ms... (${retries - 1} attempts left)`
    );

    await new Promise((resolve) => setTimeout(resolve, delay));
    
    // Exponential backoff: 1s -> 2s -> 4s
    return fetchWithExponentialBackoff(operationName, fn, retries - 1, delay * 2);
  }
}
