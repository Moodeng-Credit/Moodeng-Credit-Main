import { describe, expect, it } from 'vitest';

import {
   assessOldWallets,
   OLD_WALLET_MIN_USD,
   type OpenLoanBorrower,
   pickOldWallets
} from '../../supabase/functions/_shared/oldWalletWatch';

const OLD = '0x00000000000000000000000000000000000000a1';
const NEW = '0x00000000000000000000000000000000000000b2';
const OTHER = '0x00000000000000000000000000000000000000c3';

const borrower = (over: Partial<OpenLoanBorrower> = {}): OpenLoanBorrower => ({
   userId: 'user-1',
   username: 'sample-borrower',
   currentWallet: NEW,
   owed: 88,
   trackingIds: ['LOAN-1'],
   knownWallets: [OLD, NEW],
   ...over
});

describe('pickOldWallets', () => {
   it('keeps only wallets that are not the current one', () => {
      const picked = pickOldWallets([borrower()]);
      expect(picked.map((c) => c.wallet)).toEqual([OLD]);
   });

   it('ignores case, duplicates and junk', () => {
      const picked = pickOldWallets([
         borrower({
            currentWallet: NEW.toUpperCase().replace('0X', '0x'),
            knownWallets: [OLD, OLD.toUpperCase().replace('0X', '0x'), '', 'nope', NEW]
         })
      ]);
      expect(picked.map((c) => c.wallet)).toEqual([OLD]);
   });

   it('returns nothing when the borrower never changed wallet', () => {
      expect(pickOldWallets([borrower({ knownWallets: [NEW] })])).toEqual([]);
   });
});

describe('assessOldWallets', () => {
   const candidates = pickOldWallets([borrower()]);

   it('flags real money in an old wallet, with the facts the team needs', () => {
      const { findings, state } = assessOldWallets(candidates, { [OLD]: 90.01 }, null, {
         adminUrl: (id) => `https://example.test/admin?user=${id}`
      });
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('high');
      expect(findings[0].title).toBe('@sample-borrower has $90.01 sitting in an old wallet');
      expect(findings[0].body).toContain('They owe $88.00 (LOAN-1)');
      expect(findings[0].body).toContain(OLD);
      expect(findings[0].body).toContain('https://example.test/admin?user=user-1');
      expect(state).toEqual({ [OLD]: 90.01 });
   });

   it('ignores exchange dust under the threshold', () => {
      const { findings, state } = assessOldWallets(candidates, { [OLD]: OLD_WALLET_MIN_USD - 0.01 }, null);
      expect(findings).toEqual([]);
      expect(state).toEqual({});
   });

   it('does not repeat an alert for the same money', () => {
      const { findings, state } = assessOldWallets(candidates, { [OLD]: 90.01 }, { [OLD]: 90.01 });
      expect(findings).toEqual([]);
      expect(state).toEqual({ [OLD]: 90.01 });
   });

   it('alerts again when more arrives', () => {
      const { findings, state } = assessOldWallets(candidates, { [OLD]: 120 }, { [OLD]: 90.01 });
      expect(findings).toHaveLength(1);
      expect(state).toEqual({ [OLD]: 120 });
   });

   it('forgets a wallet once it empties, so a later deposit alerts afresh', () => {
      const emptied = assessOldWallets(candidates, { [OLD]: 0 }, { [OLD]: 90.01 });
      expect(emptied.findings).toEqual([]);
      expect(emptied.state).toEqual({});
      expect(assessOldWallets(candidates, { [OLD]: 50 }, emptied.state).findings).toHaveLength(1);
   });

   it('skips a wallet whose balance could not be read', () => {
      expect(assessOldWallets(candidates, { [OTHER]: 500 }, null).findings).toEqual([]);
   });

   it('honours a lower threshold when asked (used for the live dry run)', () => {
      expect(assessOldWallets(candidates, { [OLD]: 0.43 }, null, { minUsd: 0.1 }).findings).toHaveLength(1);
   });
});
