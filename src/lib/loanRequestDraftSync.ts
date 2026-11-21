// Mirrors a borrower's in-progress loan request to the team (2026-11-15).
//
// The resumable draft in @/lib/loanRequestDraft lives only in the borrower's browser, so when someone
// stopped half-way (e.g. at proof of income) the team couldn't see what they'd asked for. The request
// board now also writes what they typed and the screen they're on to public.loan_request_drafts
// through save_loan_request_draft() (one row per borrower, server time). Admin → Requests →
// "Started, not sent" lists them. A new loan marks the row sent in the database (trigger on loans).
//
// Fire-and-forget: a failed write never shows in, or blocks, the loan form.

import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';

/** The screen of the request form a borrower is on (or left from). */
export type LoanRequestStopStep =
   | 'terms'
   | 'referral'
   | 'access_gated'
   | 'social'
   | 'contacts'
   | 'bio1'
   | 'bio2'
   | 'job'
   | 'videocall'
   | 'income'
   | 'left_for_documents'
   | 'left_for_id_check';

export const LOAN_REQUEST_STOP_STEP_LABEL: Record<LoanRequestStopStep, string> = {
   terms: 'Amount & terms',
   referral: 'Referral code',
   access_gated: 'Waiting on access (not approved / connect)',
   social: 'Facebook / social',
   contacts: 'Messenger & WhatsApp',
   bio1: 'About you',
   bio2: 'Repayment context',
   job: 'Your job',
   videocall: 'Meet the team (call)',
   income: 'Proof of income (saw the ask)',
   left_for_documents: 'Left to send proof of income',
   left_for_id_check: 'Left for the ID check'
};

export function loanRequestStopStepLabel(step: string | null | undefined): string {
   if (!step) return 'Unknown';
   return (LOAN_REQUEST_STOP_STEP_LABEL as Record<string, string>)[step] ?? step;
}

export interface LoanRequestScreenFlags {
   showIncomeGate: boolean;
   showReferralStep: boolean;
   isLoanAccessGated: boolean;
   showSocialStep: boolean;
   showJobStep: boolean;
   showContactsStep: boolean;
   showVideoCallStep: boolean;
   showBorrowerContextStep: boolean;
   bioPage: 1 | 2;
}

/**
 * Which screen the form shows, in the same order the modal renders them: the proof-of-income ask
 * first (it covers the rest), then the referral step and the access gate, then the steps.
 */
export function loanRequestStopStep(f: LoanRequestScreenFlags): LoanRequestStopStep {
   if (f.showIncomeGate) return 'income';
   if (f.showReferralStep) return 'referral';
   if (f.isLoanAccessGated) return 'access_gated';
   if (f.showSocialStep) return 'social';
   if (f.showJobStep) return 'job';
   if (f.showContactsStep) return 'contacts';
   if (f.showVideoCallStep) return 'videocall';
   if (f.showBorrowerContextStep) return f.bioPage === 1 ? 'bio1' : 'bio2';
   return 'terms';
}

export interface LoanRequestDraftRow {
   loanAmount: string;
   totalRepaymentAmount: string;
   reason: string;
   days: string;
   step: LoanRequestStopStep;
}

const toAmount = (value: string): number | null => {
   const n = Number(value);
   return value.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null;
};

/** Only worth a row once they've typed something: an amount or a reason. */
export function hasDraftContent(row: Pick<LoanRequestDraftRow, 'loanAmount' | 'reason'>): boolean {
   return toAmount(row.loanAmount) !== null || row.reason.trim() !== '';
}

/** RPC arguments for save_loan_request_draft (exported for tests). */
export function draftRpcArgs(row: LoanRequestDraftRow) {
   return {
      p_amount: toAmount(row.loanAmount),
      p_repay: toAmount(row.totalRepaymentAmount),
      p_reason: row.reason.trim().slice(0, 2000) || null,
      p_due_date: row.days.trim().slice(0, 40) || null,
      p_stopped_at: row.step
   };
}

/** Save the row for the signed-in borrower. Never throws. */
export function syncLoanRequestDraft(row: LoanRequestDraftRow): void {
   if (!hasDraftContent(row) || !isSupabaseBrowserConfigured()) return;
   try {
      void Promise.resolve(getSupabaseBrowserClient().rpc('save_loan_request_draft', draftRpcArgs(row))).catch(() => undefined);
   } catch {
      // Team visibility only: the borrower's form keeps working either way.
   }
}
