import { describe, expect, it, vi } from 'vitest';

import { WALLET_RESPONSE_TIMEOUT_MS, WalletTimeoutError, withTimeout } from '@/lib/withTimeout';

describe('withTimeout', () => {
   it('resolves with the value when the promise settles in time', async () => {
      await expect(withTimeout(Promise.resolve('ok'), 1000)).resolves.toBe('ok');
   });

   it('propagates the underlying rejection when it settles in time', async () => {
      await expect(withTimeout(Promise.reject(new Error('boom')), 1000)).rejects.toThrow('boom');
   });

   it('rejects with WalletTimeoutError when the promise never settles', async () => {
      vi.useFakeTimers();
      try {
         const neverSettles = new Promise<string>(() => {});
         const raced = withTimeout(neverSettles, WALLET_RESPONSE_TIMEOUT_MS);
         const assertion = expect(raced).rejects.toBeInstanceOf(WalletTimeoutError);
         await vi.advanceTimersByTimeAsync(WALLET_RESPONSE_TIMEOUT_MS);
         await assertion;
      } finally {
         vi.useRealTimers();
      }
   });

   it('does not fire the timeout once the promise has resolved', async () => {
      vi.useFakeTimers();
      try {
         await expect(withTimeout(Promise.resolve('done'), WALLET_RESPONSE_TIMEOUT_MS)).resolves.toBe('done');
         // Advancing past the deadline must not surface a late WalletTimeoutError.
         await vi.advanceTimersByTimeAsync(WALLET_RESPONSE_TIMEOUT_MS);
      } finally {
         vi.useRealTimers();
      }
   });
});
