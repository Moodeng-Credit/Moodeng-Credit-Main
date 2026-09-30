// Small retry helper for the one write that must not silently fail: saving a freshly created
// Instant Wallet's address onto the account. Kept dependency-free so it's unit-testable.

/**
 * Run `task`, retrying on failure up to `attempts` times in total with a growing delay
 * (`delayMs`, then 2x, 3x…). Rethrows the last error if every attempt fails.
 */
export const retryAsync = async <T>(
   task: () => Promise<T>,
   { attempts, delayMs, sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)) }: {
      attempts: number;
      delayMs: number;
      sleep?: (ms: number) => Promise<void>;
   }
): Promise<T> => {
   let lastError: unknown;
   for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
         return await task();
      } catch (err) {
         lastError = err;
         if (attempt < attempts) await sleep(delayMs * attempt);
      }
   }
   throw lastError;
};
