import { beforeEach, describe, expect, it } from 'vitest';

import {
   beginWalletChangeIntent,
   cancelWalletChangeIntent,
   completeWalletChangeIntent,
   getWalletChangeDisposition,
   getWalletChangeIntent,
   reportWalletChangeFailure,
   WALLET_CHANGE_FAILED_EVENT
} from '@/lib/walletChangeIntent';

describe('wallet change intent', () => {
   beforeEach(() => {
      completeWalletChangeIntent();
   });

   it('keeps the saved wallet associated with an active explicit change', () => {
      const id = beginWalletChangeIntent(' 0xABCDEF ', 1_000);

      expect(getWalletChangeIntent(1_001)).toMatchObject({
         id,
         previousAddress: '0xabcdef',
         status: 'active'
      });
   });

   it('marks a cancelled attempt so a late wallet approval can be rejected', () => {
      const id = beginWalletChangeIntent('0xabcdef', 1_000);
      cancelWalletChangeIntent(id, 2_000);

      expect(getWalletChangeIntent(2_001)).toMatchObject({ id, status: 'cancelled' });
   });

   it('expires abandoned intents and clears completed ones', () => {
      const id = beginWalletChangeIntent('0xabcdef', 1_000);
      expect(getWalletChangeIntent(500_000)).toBeNull();

      const nextId = beginWalletChangeIntent('0xabcdef', 600_000);
      completeWalletChangeIntent(nextId);
      expect(getWalletChangeIntent(600_001)).toBeNull();
      expect(nextId).not.toBe(id);
   });

   it('rejects a late lender approval after the settings change was cancelled', () => {
      const id = beginWalletChangeIntent('0xaaaa', 1_000);
      cancelWalletChangeIntent(id, 2_000);

      expect(
         getWalletChangeDisposition({
            intent: getWalletChangeIntent(2_001),
            storedAddress: '0xaaaa',
            connectedAddress: '0xbbbb',
            role: 'lender'
         })
      ).toBe('cancelled-change');
   });

   it('allows an explicit borrower change but rejects an unconfirmed mismatch', () => {
      beginWalletChangeIntent('0xaaaa', 1_000);
      const intent = getWalletChangeIntent(1_001);

      expect(
         getWalletChangeDisposition({
            intent,
            storedAddress: '0xaaaa',
            connectedAddress: '0xbbbb',
            role: 'borrower'
         })
      ).toBe('explicit-change');
      expect(
         getWalletChangeDisposition({
            intent: null,
            storedAddress: '0xaaaa',
            connectedAddress: '0xbbbb',
            role: 'borrower'
         })
      ).toBe('borrower-mismatch');
   });

   it('reports a save failure to the open change flow and clears the active intent', () => {
      const id = beginWalletChangeIntent('0xaaaa');
      let detail: { intentId?: string; message?: string } | undefined;
      const listener = (event: Event) => {
         detail = (event as CustomEvent<{ intentId?: string; message?: string }>).detail;
      };
      window.addEventListener(WALLET_CHANGE_FAILED_EVENT, listener);

      reportWalletChangeFailure(id, 'Wallet save failed');

      window.removeEventListener(WALLET_CHANGE_FAILED_EVENT, listener);
      expect(detail).toEqual({ intentId: id, message: 'Wallet save failed' });
      expect(getWalletChangeIntent()).toBeNull();
   });
});
