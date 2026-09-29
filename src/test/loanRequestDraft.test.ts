import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
   clearLoanRequestDraft,
   draftIsResumable,
   LOAN_REQUEST_DRAFT_TTL_MS,
   loadLoanRequestDraft,
   saveLoanRequestDraft,
   type LoanRequestDraft
} from '@/lib/loanRequestDraft';

const STORAGE_KEY = 'moodeng-loan-request-draft';

const makeDraft = (overrides: Partial<LoanRequestDraft> = {}): LoanRequestDraft => ({
   terms: { loanAmount: '20', totalRepaymentAmount: '23', reason: 'Rent before payday', days: '2026-10-15' },
   referral: null,
   flow: {
      showReferralStep: false,
      showBorrowerContextStep: false,
      bioPage: 1,
      showContactsStep: true,
      showVideoCallStep: false,
      contactsStepDone: false,
      videoCallStepDone: false,
      borrowerContextPromptSeen: true
   },
   borrowerContext: { incomeSetup: 'full_time', paydayWindow: '10_15', cashGaps: ['gap_before_payday'] },
   profileName: 'Maya',
   ...overrides
});

describe('loanRequestDraft store', () => {
   beforeEach(() => {
      window.localStorage.clear();
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-27T10:00:00Z'));
   });

   afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
      window.localStorage.clear();
   });

   it('round-trips a draft for the same user', () => {
      const draft = makeDraft();
      saveLoanRequestDraft('user-1', draft);
      expect(loadLoanRequestDraft('user-1')).toEqual(draft);
   });

   it('never returns a draft saved by a different account, but leaves that live draft intact', () => {
      saveLoanRequestDraft('user-1', makeDraft());
      // A different signed-in user must not see it…
      expect(loadLoanRequestDraft('user-2')).toBeNull();
      // …and it must not have been wiped — the original owner can still resume.
      expect(loadLoanRequestDraft('user-1')).not.toBeNull();
   });

   it('drops a draft once it is older than the TTL', () => {
      saveLoanRequestDraft('user-1', makeDraft());
      vi.advanceTimersByTime(LOAN_REQUEST_DRAFT_TTL_MS + 1);
      expect(loadLoanRequestDraft('user-1')).toBeNull();
      // And it was cleared, not just hidden.
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
   });

   it('keeps a draft that is still within the TTL', () => {
      saveLoanRequestDraft('user-1', makeDraft());
      vi.advanceTimersByTime(LOAN_REQUEST_DRAFT_TTL_MS - 1000);
      expect(loadLoanRequestDraft('user-1')).not.toBeNull();
   });

   it('ignores and clears a record from an older schema version', () => {
      const stale = { v: 0, userId: 'user-1', savedAt: Date.now(), ...makeDraft() };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stale));
      expect(loadLoanRequestDraft('user-1')).toBeNull();
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
   });

   it('ignores and clears a corrupt record', () => {
      window.localStorage.setItem(STORAGE_KEY, '{not json');
      expect(loadLoanRequestDraft('user-1')).toBeNull();
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
   });

   it('clearLoanRequestDraft removes the record', () => {
      saveLoanRequestDraft('user-1', makeDraft());
      clearLoanRequestDraft();
      expect(loadLoanRequestDraft('user-1')).toBeNull();
   });

   it('does nothing and never throws when a userId is missing', () => {
      expect(() => saveLoanRequestDraft('', makeDraft())).not.toThrow();
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(loadLoanRequestDraft('')).toBeNull();
   });

   it('survives a storage that throws on read (private mode) without throwing', () => {
      saveLoanRequestDraft('user-1', makeDraft());
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
         throw new Error('SecurityError');
      });
      expect(() => loadLoanRequestDraft('user-1')).not.toThrow();
      expect(loadLoanRequestDraft('user-1')).toBeNull();
      spy.mockRestore();
   });

   it('survives a storage that throws on write without throwing', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
         throw new Error('QuotaExceeded');
      });
      expect(() => saveLoanRequestDraft('user-1', makeDraft())).not.toThrow();
      spy.mockRestore();
   });

   describe('draftIsResumable', () => {
      it('is false for a draft that never left the terms screen', () => {
         const draft = makeDraft({
            flow: {
               showReferralStep: false,
               showBorrowerContextStep: false,
               bioPage: 1,
               showContactsStep: false,
               showVideoCallStep: false,
               contactsStepDone: false,
               videoCallStepDone: false,
               borrowerContextPromptSeen: false
            }
         });
         expect(draftIsResumable(draft)).toBe(false);
      });

      it('is true on the contacts step (the Messenger-hop case)', () => {
         expect(draftIsResumable(makeDraft())).toBe(true);
      });

      it('is true once contacts is done, even if no step flag is currently up', () => {
         const draft = makeDraft({
            flow: {
               showReferralStep: false,
               showBorrowerContextStep: false,
               bioPage: 1,
               showContactsStep: false,
               showVideoCallStep: false,
               contactsStepDone: true,
               videoCallStepDone: false,
               borrowerContextPromptSeen: true
            }
         });
         expect(draftIsResumable(draft)).toBe(true);
      });
   });
});
