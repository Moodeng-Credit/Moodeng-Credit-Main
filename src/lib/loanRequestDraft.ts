// Makes the multi-step loan request resumable across a full page reload.
//
// Why this exists: the Facebook/Messenger contact step sends the borrower out to Facebook's own
// m.me page (and often the Messenger app). On phones — iPhone especially — coming back frequently
// reloads our web app in the same tab, which wipes the modal's in-memory React state. The borrower
// then lands back on step 1 instead of on the Facebook step, even though the bot already verified
// them in the background. We can't stop the reload (the hop is Facebook's), so instead we snapshot
// where they were and restore it on the next load.
//
// This never trusts the snapshot for anything that must be true server-side: whether Messenger is
// actually verified is always re-read from the users table by ContactsStep. The snapshot only puts
// the borrower back on the right screen with the terms they'd already typed, so one tap finishes.
//
// Storage notes: localStorage, not sessionStorage. The whole point is to survive the trip out to
// Facebook and back, and on iPhone that trip often lands the borrower in a *different* browsing
// context — the Facebook/Messenger in-app browser opens m.me in a fresh webview, and a Home-Screen
// PWA can be killed and relaunched — which resets sessionStorage. localStorage carries across those,
// so the resume actually fires where it's needed most. It's kept safe by three guards, not by the
// storage lifetime: the record is scoped to a userId (never resurfaces on the wrong account on a
// shared device), stamped with a time (dropped after the TTL, so stale terms can't reopen), and
// explicitly cleared on submit and on a deliberate close. Every access is wrapped — Safari private
// mode throws on write, reads can come back empty — so a storage failure just means "no resume".

import type { BorrowerContextState } from '@/lib/borrowerContextFit';
import type { AppliedReferralCode } from '@/views/dashboard/components/LoanRequestModal';

const STORAGE_KEY = 'moodeng-loan-request-draft';
const SCHEMA_VERSION = 1;
// Long enough to hop to Messenger, tap around, maybe reinstall the app, and come back; short enough
// that a draft from a much earlier session (with stale terms) never silently reopens.
export const LOAN_REQUEST_DRAFT_TTL_MS = 30 * 60 * 1000;

// Which screen of the request flow the borrower was on. Mirrors the boolean step flags inside
// LoanRequestModal so restoring is a straight assignment, not a re-derivation.
export interface LoanRequestFlowState {
   showReferralStep: boolean;
   showBorrowerContextStep: boolean;
   bioPage: 1 | 2;
   showContactsStep: boolean;
   showVideoCallStep: boolean;
   contactsStepDone: boolean;
   videoCallStepDone: boolean;
   borrowerContextPromptSeen: boolean;
}

export interface LoanRequestTerms {
   loanAmount: string;
   totalRepaymentAmount: string;
   reason: string;
   days: string;
}

export interface LoanRequestDraft {
   terms: LoanRequestTerms;
   referral: AppliedReferralCode | null;
   flow: LoanRequestFlowState;
   borrowerContext: BorrowerContextState;
   profileName: string;
}

interface StoredDraft extends LoanRequestDraft {
   v: number;
   userId: string;
   savedAt: number;
}

const getStore = (): Storage | null => {
   try {
      return typeof window !== 'undefined' ? window.localStorage : null;
   } catch {
      return null;
   }
};

/**
 * Snapshot the in-progress request for `userId`. A no-op (never throws) when storage is unavailable.
 */
export function saveLoanRequestDraft(userId: string, draft: LoanRequestDraft): void {
   const store = getStore();
   if (!store || !userId) return;
   try {
      const record: StoredDraft = { v: SCHEMA_VERSION, userId, savedAt: Date.now(), ...draft };
      store.setItem(STORAGE_KEY, JSON.stringify(record));
   } catch {
      // Private mode / quota: the borrower simply won't get a resume this time.
   }
}

/**
 * Return the saved draft for `userId`, or null when there isn't a valid, fresh, matching one.
 * A draft for a different account, an old schema, or one past its TTL is treated as absent (and
 * cleared), so it can never reopen on the wrong person or with stale terms.
 */
export function loadLoanRequestDraft(userId: string): LoanRequestDraft | null {
   const store = getStore();
   if (!store || !userId) return null;
   let raw: string | null = null;
   try {
      raw = store.getItem(STORAGE_KEY);
   } catch {
      return null;
   }
   if (!raw) return null;

   let record: Partial<StoredDraft> | null = null;
   try {
      record = JSON.parse(raw) as Partial<StoredDraft>;
   } catch {
      clearLoanRequestDraft();
      return null;
   }

   const isStale = typeof record?.savedAt !== 'number' || Date.now() - record.savedAt > LOAN_REQUEST_DRAFT_TTL_MS;
   if (!record || record.v !== SCHEMA_VERSION || record.userId !== userId || isStale || !record.flow || !record.terms) {
      // A mismatch on account or version is a good moment to drop the dead record; a fresh draft for
      // a *different* signed-in user shouldn't be wiped, so only clear when it isn't a live one.
      if (!record || record.v !== SCHEMA_VERSION || isStale) clearLoanRequestDraft();
      return null;
   }

   return {
      terms: record.terms,
      referral: record.referral ?? null,
      flow: record.flow,
      borrowerContext: record.borrowerContext ?? { incomeSetup: '', paydayWindow: '', cashGaps: [] },
      profileName: record.profileName ?? ''
   };
}

/** Drop any saved draft. Called on submit, on close, and on sign-out. Never throws. */
export function clearLoanRequestDraft(): void {
   const store = getStore();
   if (!store) return;
   try {
      store.removeItem(STORAGE_KEY);
   } catch {
      // Nothing more we can do; a stale record will still fail the userId/TTL checks on load.
   }
}

/**
 * True when a draft is worth reopening the modal for: the borrower had actually stepped past the
 * first screen (into bio, contacts, or the video call). A draft that only ever saw the terms screen
 * isn't resumed — reopening the whole modal for an untouched form would be more surprising than
 * helpful.
 */
export function draftIsResumable(draft: LoanRequestDraft): boolean {
   const { flow } = draft;
   return flow.showBorrowerContextStep || flow.showContactsStep || flow.showVideoCallStep || flow.contactsStepDone;
}
