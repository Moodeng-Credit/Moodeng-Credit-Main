// Maps a row of the changes log (public.state_events, migration 20261011170000) to the after-state
// stamped on the Telegram cards and Discord posts about it (adminCards.ts stampDecisionCards).
//
// `final` = the terminal state: the refs are claimed (deleted) so nothing stamps them again.
// Non-final states (funded, overdue, partial, in review, showed up) keep the refs so the next state
// re-stamps the same messages — re-rendered from the original, never stacked.
import type { AdminCardKind } from './adminCards.ts';

export type StateEvent = {
   id: number;
   kind: string;
   ref_id: string;
   user_id: string | null;
   from_state: string | null;
   to_state: string;
   actor: string | null;
   meta: Record<string, unknown> | null;
   created_at?: string;
};

export type EventStamp = {
   cardKind: AdminCardKind;
   refId: string;
   header: string;
   detail?: string | null;
   by: string;
   verb: string;
   final: boolean;
};

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export const stateEventStamp = (event: StateEvent): EventStamp | null => {
   const meta = event.meta ?? {};
   const actor = str(event.actor) && event.actor !== 'system' ? str(event.actor) : null;
   const base = { refId: event.ref_id, by: actor ?? 'system', verb: actor ? 'Decided by' : 'Updated by' };
   const to = event.to_state;

   switch (event.kind) {
      case 'loan': {
         const loan = { ...base, cardKind: 'loan' as const };
         switch (to) {
            case 'funded': {
               const lender = str(meta.lender) ?? actor;
               return { ...loan, header: lender ? `✅ FUNDED by ${lender}` : '✅ FUNDED', verb: 'Funded by', by: lender ?? 'a lender', final: false };
            }
            case 'partial':
               return { ...loan, header: '💵 PARTIALLY REPAID', final: false };
            case 'overdue':
               return { ...loan, header: '⚠️ OVERDUE', final: false };
            case 'repaid':
               return { ...loan, header: meta.late === true ? '💸 REPAID (late)' : '💸 REPAID', final: true };
            case 'refunded':
               return { ...loan, header: '↩️ REFUNDED', detail: str(meta.reason) ? `Reason: ${str(meta.reason)}` : null, final: true };
            case 'deleted':
               return { ...loan, header: '🗑 DELETED', final: true };
            case 'expired':
               // A request can still be deleted (or, rarely, funded) after it expires.
               return { ...loan, header: '⌛ EXPIRED', final: false };
         }
         return null;
      }
      case 'loan_access':
      case 'loan_access_request': {
         const access = { ...base, cardKind: 'loan_access' as const };
         if (to === 'approved') return { ...access, header: '✅ APPROVED — can now apply for a loan', final: true };
         if (to === 'rejected') return { ...access, header: '❌ REJECTED', final: true };
         if (to === 'no_show') return { ...access, header: '🚫 NO-SHOW', final: true };
         return null;
      }
      case 'video_call': {
         const access = { ...base, cardKind: 'loan_access' as const };
         if (to === 'attended') return { ...access, header: '✅ SHOWED UP — awaiting approval', final: false };
         if (to === 'no_show') return { ...access, header: '🚫 NO-SHOW', final: true };
         return null;
      }
      case 'kyc': {
         const kyc = { ...base, cardKind: 'kyc_review' as const };
         if (to === 'approved') return { ...kyc, header: '✅ KYC APPROVED', final: true };
         if (to === 'declined') return { ...kyc, header: '❌ KYC DECLINED', detail: str(meta.reason) ? `Reason: ${str(meta.reason)}` : null, final: true };
         if (to === 'duplicate') return { ...kyc, header: '⛔ KYC DUPLICATE', final: true };
         if (to === 'in_review') return { ...kyc, header: '🔎 KYC IN REVIEW', final: false };
         return null;
      }
      case 'voucher': {
         const voucher = { ...base, cardKind: 'voucher' as const };
         if (to === 'sent') return { ...voucher, header: '✅ VOUCHER SENT', final: true };
         if (to === 'rejected') return { ...voucher, header: '❌ VOUCHER REJECTED', final: true };
         if (to === 'banked') return { ...voucher, header: '🏦 BANKED — added to their GrabMart wallet; a ₱100 code goes out automatically', final: true };
         return null;
      }
      case 'messenger':
         return to === 'verified' ? { ...base, cardKind: 'messenger', header: '✅ MESSENGER VERIFIED', final: true } : null;
   }
   return null;
};
