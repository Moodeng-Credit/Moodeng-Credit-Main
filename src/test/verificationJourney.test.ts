import { describe, expect, it } from 'vitest';

import { getJourney } from '@/lib/verificationJourney';

const WALLET = '0x1111111111111111111111111111111111111111';
const base = { isWorldId: 'INACTIVE', isDidit: 'INACTIVE' } as const;

describe('getJourney — onboarding is wallet → Messenger → bio → call → ✅, then apply (ID check last)', () => {
   it('no wallet: step 1, set up wallet', () => {
      expect(getJourney({ ...base }, true)).toMatchObject({ stage: 'wallet', step: 1, onboarding: true, action: 'wallet' });
   });

   it('held by the gate, walking through step 2 and 3', () => {
      const u = { ...base, walletAddress: WALLET };
      expect(getJourney(u, true)).toMatchObject({ stage: 'messenger', step: 2, action: 'connect' });
      expect(getJourney({ ...u, hasVerifiedContact: true }, true)).toMatchObject({ stage: 'about', step: 2 });
      expect(getJourney({ ...u, hasVerifiedContact: true, incomeType: 'full-time' }, true)).toMatchObject({ stage: 'book_call', step: 3 });
      expect(getJourney({ ...u, loanAccessStatus: 'pending' }, true)).toMatchObject({ stage: 'call_booked', step: 3 });
   });

   it('through onboarding (approved / not gated): apply — the ID check is part of the request, not a step', () => {
      expect(getJourney({ ...base, walletAddress: WALLET, loanAccessStatus: 'approved' }, false)).toMatchObject({
         stage: 'apply',
         step: null,
         onboarding: false,
         action: 'apply'
      });
   });

   it('ID already with Didit shows its status; verified is done', () => {
      expect(getJourney({ ...base, walletAddress: WALLET, diditIdStatus: 'In Review' }, false).stage).toBe('id_with_didit');
      expect(getJourney({ ...base, isDidit: 'ACTIVE' }, false).stage).toBe('verified');
   });
});
