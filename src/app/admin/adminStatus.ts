import { DEFAULT_LOAN_TIMEZONE, getLoanTimezone, isPastDueDay } from '@/lib/loanDeadline';
import { getVerificationUiState } from '@/lib/verificationUiState';
import { WorldId, type WorldIdStatus } from '@/types/authTypes';

// One vocabulary for borrower / loan states across every admin tab, so "Approved" in the directory,
// the Requests tab and the live feed always means the same thing and looks the same.

export type AdminStatus =
   | 'pending_call'
   | 'call_booked'
   | 'approved'
   | 'verified'
   | 'in_review'
   | 'declined'
   | 'duplicate'
   | 'banned'
   | 'watchlist'
   | 'requested'
   | 'funded'
   | 'overdue'
   | 'repaid'
   | 'refunded'
   | 'expired'
   | 'new';

export interface AdminStatusMeta {
   label: string;
   emoji: string;
   className: string;
}

export const ADMIN_STATUS_META: Record<AdminStatus, AdminStatusMeta> = {
   pending_call: { label: 'Pending call', emoji: '⏳', className: 'bg-amber-900/50 text-amber-300' },
   call_booked: { label: 'Call booked', emoji: '📅', className: 'bg-sky-900/50 text-sky-300' },
   approved: { label: 'Approved', emoji: '👍', className: 'bg-emerald-900/50 text-emerald-300' },
   verified: { label: 'Verified', emoji: '✅', className: 'bg-green-900/50 text-green-300' },
   in_review: { label: 'In review', emoji: '🔎', className: 'bg-yellow-900/50 text-yellow-300' },
   declined: { label: 'Declined', emoji: '✖️', className: 'bg-red-900/50 text-red-300' },
   duplicate: { label: 'Duplicate', emoji: '👯', className: 'bg-rose-900/50 text-rose-300' },
   banned: { label: 'Banned', emoji: '⛔', className: 'bg-red-950 text-red-400' },
   watchlist: { label: 'Watchlist', emoji: '👀', className: 'bg-orange-900/50 text-orange-300' },
   requested: { label: 'Requested', emoji: '📝', className: 'bg-purple-900/50 text-purple-300' },
   funded: { label: 'Funded', emoji: '💸', className: 'bg-blue-900/50 text-blue-300' },
   overdue: { label: 'Overdue', emoji: '⚠️', className: 'bg-red-900/50 text-red-300' },
   repaid: { label: 'Repaid', emoji: '🎉', className: 'bg-emerald-900/50 text-emerald-300' },
   refunded: { label: 'Refunded', emoji: '↩️', className: 'bg-slate-800 text-slate-300' },
   expired: { label: 'Expired', emoji: '🗑️', className: 'bg-[#241044] text-[#a89bb8]' },
   new: { label: 'New', emoji: '🆕', className: 'bg-[#241044] text-[#a89bb8]' }
};

export interface BorrowerStatusInput {
   account_status?: string | null;
   restriction?: { status?: string | null } | null;
   is_world_id?: string | null;
   is_didit?: string | null;
   didit_id_status?: string | null;
   didit_submitted_at?: string | null;
   loan_access_status?: string | null;
   video_call_starts_at?: string | null;
   video_call_outcome?: string | null;
}

const asWorldId = (value: string | null | undefined): WorldIdStatus => (value === WorldId.ACTIVE ? WorldId.ACTIVE : WorldId.INACTIVE);

/** Where a borrower is in Connect → Call → Approve → Verify, with bans / watchlist taking priority. */
export function deriveBorrowerStatus(user: BorrowerStatusInput): AdminStatus {
   if (user.account_status === 'banned' || user.restriction?.status === 'banned') return 'banned';
   if (user.account_status === 'blocked' || user.restriction?.status === 'watchlist') return 'watchlist';

   const verification = getVerificationUiState({
      isWorldId: asWorldId(user.is_world_id),
      isDidit: asWorldId(user.is_didit),
      diditIdStatus: user.didit_id_status ?? undefined,
      diditSubmittedAt: user.didit_submitted_at ?? undefined
   });
   if (verification === 'verified') return 'verified';
   if (verification === 'duplicate') return 'duplicate';
   if (verification === 'declined') return 'declined';
   if (verification === 'review' || verification === 'processing') return 'in_review';

   if (user.loan_access_status === 'approved') return 'approved';
   if (user.loan_access_status === 'rejected') return 'declined';
   if (user.video_call_starts_at && !user.video_call_outcome) return 'call_booked';
   if (user.loan_access_status === 'pending') return 'pending_call';
   return 'new';
}

export interface LoanStatusInput {
   loan_status?: string | null;
   repayment_status?: string | null;
   due_date?: string | null;
   due_timezone?: string | null;
   refunded_at?: string | null;
}

/** Loan lifecycle: Requested → Funded → Overdue / Repaid, or Refunded. Same overdue rule as isAdminLoanOverdue. */
export function deriveLoanStatus(loan: LoanStatusInput, now: Date | number = Date.now()): AdminStatus {
   if (loan.refunded_at) return 'refunded';
   if (loan.loan_status === 'Requested') return 'requested';
   if (loan.loan_status === 'Lent') {
      if (loan.repayment_status === 'Paid') return 'repaid';
      const overdue =
         Boolean(loan.due_date) &&
         isPastDueDay(loan.due_date as string, getLoanTimezone({ dueTimezone: loan.due_timezone }, DEFAULT_LOAN_TIMEZONE), now);
      return overdue ? 'overdue' : 'funded';
   }
   return 'expired';
}

/** A loan_access_requests row (Requests tab, call approvals, live feed). */
export function deriveAccessRequestStatus(
   request: { status?: string | null; expires_at?: string | null },
   now: number = Date.now()
): AdminStatus {
   if (request.status === 'approved') return 'approved';
   if (request.status === 'rejected' || request.status === 'declined') return 'declined';
   if (request.status === 'expired' || (request.expires_at && new Date(request.expires_at).getTime() < now)) return 'expired';
   return 'pending_call';
}
