import { base } from 'wagmi/chains';
import { describe, expect, it, vi } from 'vitest';

import { ensureAllowedChain } from '@/lib/ensureAllowedChain';
import { ALLOWED_CHAIN_ID } from '@/config/wagmiConfig';
import { WALLET_CHAIN_SWITCH_TIMEOUT_MS } from '@/lib/withTimeout';

describe('ensureAllowedChain', () => {
   it('allows Base without asking the wallet to switch', async () => {
      expect(ALLOWED_CHAIN_ID).toBe(base.id);
      const switchChainAsync = vi.fn();

      const ok = await ensureAllowedChain(ALLOWED_CHAIN_ID, switchChainAsync);

      expect(ok).toBe(true);
      expect(switchChainAsync).not.toHaveBeenCalled();
   });

   it('switches a wallet on the wrong chain to Base and proceeds', async () => {
      const switchChainAsync = vi.fn().mockResolvedValue(undefined);

      const ok = await ensureAllowedChain(1, switchChainAsync);

      expect(ok).toBe(true);
      expect(switchChainAsync).toHaveBeenCalledWith({ chainId: ALLOWED_CHAIN_ID });
   });

   it('switches to Base when the chain has not hydrated yet (undefined)', async () => {
      const switchChainAsync = vi.fn().mockResolvedValue(undefined);

      const ok = await ensureAllowedChain(undefined, switchChainAsync);

      expect(ok).toBe(true);
      expect(switchChainAsync).toHaveBeenCalledWith({ chainId: ALLOWED_CHAIN_ID });
   });

   it('reports failure when the user rejects the switch', async () => {
      const switchChainAsync = vi.fn().mockRejectedValue(new Error('User rejected'));

      const ok = await ensureAllowedChain(137, switchChainAsync);

      expect(ok).toBe(false);
   });

   it('reports failure when the wallet never responds to the switch (times out)', async () => {
      vi.useFakeTimers();
      try {
         // A wallet that isn't actually reachable on this device never resolves the switch.
         const switchChainAsync = vi.fn(() => new Promise<unknown>(() => {}));

         const promise = ensureAllowedChain(1, switchChainAsync);
         await vi.advanceTimersByTimeAsync(WALLET_CHAIN_SWITCH_TIMEOUT_MS);

         await expect(promise).resolves.toBe(false);
      } finally {
         vi.useRealTimers();
      }
   });
});
