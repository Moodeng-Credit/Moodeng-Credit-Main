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

describe('getJourney — journey v2: proof of income + 3 videos first, wallet after the ✅', () => {
   const v2 = (over: Record<string, unknown> = {}) => ({ applies: true, income: 'none' as const, videos_watched: 0, done: false, ...over });

   it('held by the gate with v2 steps left: verify first, no wallet asked yet', () => {
      expect(getJourney({ ...base }, true, v2())).toMatchObject({ stage: 'verify', step: 1, action: 'verify_first', cta: 'Send proof of income' });
      expect(getJourney({ ...base }, true, v2({ income: 'checking' }))).toMatchObject({ stage: 'verify', cta: 'See your check' });
   });

   it('v2 done: on to Messenger without a wallet', () => {
      expect(getJourney({ ...base }, true, v2({ income: 'pass', done: true }))).toMatchObject({ stage: 'messenger', action: 'connect' });
   });

   it('approved (gate lets go): the wallet comes back before applying', () => {
      expect(getJourney({ ...base, loanAccessStatus: 'approved' }, false, null)).toMatchObject({ stage: 'wallet', action: 'wallet' });
   });

   it('v2 off for this person: the old order (wallet first)', () => {
      expect(getJourney({ ...base }, true, { applies: false })).toMatchObject({ stage: 'wallet' });
   });
});

describe('getJourney — wallet last: the wallet is part of sending the request, never a stage', () => {
   it('no wallet and the switch on: straight to the gate steps, then apply', () => {
      expect(getJourney({ ...base }, true, null, true)).toMatchObject({ stage: 'messenger', action: 'connect' });
      expect(getJourney({ ...base, loanAccessStatus: 'approved' }, false, null, true)).toMatchObject({ stage: 'apply', action: 'apply' });
   });

   it('switch off: wallet first, as before', () => {
      expect(getJourney({ ...base }, true, null, false)).toMatchObject({ stage: 'wallet' });
   });
});

describe('getJourney — pre-screening path (affiliate link): Facebook → answers → team ✅ → wallet', () => {
   const path = (over: Record<string, unknown> = {}) => ({ on_path: true, status: 'none' as const, decision: null, done: false, ...over });

   it('no wallet asked before the team says yes', () => {
      expect(getJourney({ ...base }, true, null, false, path())).toMatchObject({ stage: 'messenger', action: 'connect' });
      expect(getJourney({ ...base, hasVerifiedContact: true }, true, null, false, path())).toMatchObject({ stage: 'prescreen', action: 'prescreen' });
      expect(getJourney({ ...base, hasVerifiedContact: true }, true, null, false, path({ status: 'graded' }))).toMatchObject({
         stage: 'prescreen_wait',
         action: 'prescreen'
      });
   });

   it('after the ✅: the wallet first, then the rest', () => {
      expect(getJourney({ ...base, hasVerifiedContact: true }, true, null, false, path({ status: 'graded', decision: 'good', done: true }))).toMatchObject({
         stage: 'wallet'
      });
   });

   it('rejected: no pre-screening nudge', () => {
      expect(getJourney({ ...base, hasVerifiedContact: true, loanAccessStatus: 'rejected' }, true, null, false, path()).stage).not.toBe('prescreen');
   });
});
