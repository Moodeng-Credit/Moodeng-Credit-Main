import { describe, expect, it } from 'vitest';

import {
   draftRpcArgs,
   hasDraftContent,
   type LoanRequestScreenFlags,
   loanRequestStopStep,
   loanRequestStopStepLabel
} from '@/lib/loanRequestDraftSync';

const flags = (overrides: Partial<LoanRequestScreenFlags> = {}): LoanRequestScreenFlags => ({
   showIncomeGate: false,
   showReferralStep: false,
   isLoanAccessGated: false,
   showSocialStep: false,
   showJobStep: false,
   showContactsStep: false,
   showVideoCallStep: false,
   showBorrowerContextStep: false,
   bioPage: 1,
   ...overrides
});

describe('loanRequestStopStep', () => {
   it('is the terms screen when nothing else is showing', () => {
      expect(loanRequestStopStep(flags())).toBe('terms');
   });

   it('names each step', () => {
      expect(loanRequestStopStep(flags({ showContactsStep: true }))).toBe('contacts');
      expect(loanRequestStopStep(flags({ showJobStep: true }))).toBe('job');
      expect(loanRequestStopStep(flags({ showVideoCallStep: true }))).toBe('videocall');
      expect(loanRequestStopStep(flags({ showSocialStep: true }))).toBe('social');
      expect(loanRequestStopStep(flags({ showReferralStep: true }))).toBe('referral');
      expect(loanRequestStopStep(flags({ isLoanAccessGated: true }))).toBe('access_gated');
      expect(loanRequestStopStep(flags({ showBorrowerContextStep: true, bioPage: 1 }))).toBe('bio1');
      expect(loanRequestStopStep(flags({ showBorrowerContextStep: true, bioPage: 2 }))).toBe('bio2');
   });

   it('puts the proof-of-income ask first: it covers the rest of the form', () => {
      expect(loanRequestStopStep(flags({ showIncomeGate: true, showContactsStep: true, showJobStep: true }))).toBe('income');
   });
});

describe('loanRequestStopStepLabel', () => {
   it('has a label for the hand-off keys and falls back to the raw key', () => {
      expect(loanRequestStopStepLabel('left_for_documents')).toBe('Left to send proof of income');
      expect(loanRequestStopStepLabel('something_new')).toBe('something_new');
      expect(loanRequestStopStepLabel(null)).toBe('Unknown');
   });
});

describe('draftRpcArgs / hasDraftContent', () => {
   const row = { loanAmount: '100', totalRepaymentAmount: '115', reason: '  School fees  ', days: '2026-12-01', step: 'income' as const };

   it('sends numbers, trimmed text and the step', () => {
      expect(draftRpcArgs(row)).toEqual({ p_amount: 100, p_repay: 115, p_reason: 'School fees', p_due_date: '2026-12-01', p_stopped_at: 'income' });
   });

   it('sends null for blanks and junk instead of throwing', () => {
      expect(draftRpcArgs({ ...row, loanAmount: '', totalRepaymentAmount: 'abc', reason: '   ', days: '' })).toEqual({
         p_amount: null,
         p_repay: null,
         p_reason: null,
         p_due_date: null,
         p_stopped_at: 'income'
      });
   });

   it('only writes once an amount or a reason is typed', () => {
      expect(hasDraftContent({ loanAmount: '', reason: ' ' })).toBe(false);
      expect(hasDraftContent({ loanAmount: '20', reason: '' })).toBe(true);
      expect(hasDraftContent({ loanAmount: '', reason: 'Rent' })).toBe(true);
   });
});
