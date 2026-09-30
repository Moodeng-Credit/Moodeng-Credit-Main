import { describe, expect, it, vi } from 'vitest';

import { retryAsync } from '@/lib/web3/openfort/retry';

const noSleep = () => Promise.resolve();

describe('retryAsync', () => {
   it('returns the first success without retrying', async () => {
      const task = vi.fn().mockResolvedValue('ok');
      await expect(retryAsync(task, { attempts: 3, delayMs: 10, sleep: noSleep })).resolves.toBe('ok');
      expect(task).toHaveBeenCalledTimes(1);
   });

   it('retries after a failure and returns the later success', async () => {
      const task = vi.fn().mockRejectedValueOnce(new Error('flaky')).mockResolvedValue('ok');
      await expect(retryAsync(task, { attempts: 3, delayMs: 10, sleep: noSleep })).resolves.toBe('ok');
      expect(task).toHaveBeenCalledTimes(2);
   });

   it('rethrows the last error once every attempt has failed', async () => {
      const task = vi.fn().mockRejectedValueOnce(new Error('first')).mockRejectedValue(new Error('last'));
      await expect(retryAsync(task, { attempts: 3, delayMs: 10, sleep: noSleep })).rejects.toThrow('last');
      expect(task).toHaveBeenCalledTimes(3);
   });

   it('waits a growing delay between attempts', async () => {
      const sleep = vi.fn().mockResolvedValue(undefined);
      const task = vi.fn().mockRejectedValue(new Error('nope'));
      await expect(retryAsync(task, { attempts: 3, delayMs: 100, sleep })).rejects.toThrow('nope');
      expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([100, 200]);
   });
});
