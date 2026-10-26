import { describe, expect, it } from 'vitest';

import { isLostSignerError } from '@/lib/web3/openfort/sendErrors';

describe('isLostSignerError', () => {
   it('matches the viem-wrapped error a borrower hit on iPhone Safari', () => {
      const wrapped = new Error(
         'The contract function "transfer" reverted with the following reason:\nSigner is not configured\n\nContract Call:\n  address:   0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
      );
      expect(isLostSignerError(wrapped)).toBe(true);
   });

   it('matches Openfort error codes anywhere on the cause chain', () => {
      const openfort = Object.assign(new Error('opaque'), { error: 'NOT_CONFIGURED' });
      expect(isLostSignerError(new Error('outer', { cause: new Error('middle', { cause: openfort }) }))).toBe(true);
      expect(isLostSignerError({ error: 'MISSING_PROJECT_ENTROPY' })).toBe(true);
   });

   it('matches the other pre-signature iframe failures', () => {
      expect(isLostSignerError(new Error('Wallet session ended before setup completed.'))).toBe(true);
      expect(isLostSignerError(new Error('Iframe connection was closed while sign() was in flight.'))).toBe(true);
   });

   it('leaves real payment failures alone', () => {
      expect(isLostSignerError(new Error('ERC20: transfer amount exceeds balance'))).toBe(false);
      expect(isLostSignerError(new Error('User rejected the request.'))).toBe(false);
      expect(isLostSignerError({ error: 'INSUFFICIENT_FUNDS' })).toBe(false);
      expect(isLostSignerError(null)).toBe(false);
      expect(isLostSignerError(undefined)).toBe(false);
   });

   it('survives a cyclic cause chain', () => {
      const a: { message: string; cause?: unknown } = { message: 'a' };
      a.cause = { message: 'b', cause: a };
      expect(isLostSignerError(a)).toBe(false);
   });
});
