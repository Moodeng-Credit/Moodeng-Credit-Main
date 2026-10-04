import { format } from 'date-fns';

import { parseDateSafely } from '@/utils/dateFormatters';
import { isLoanPastDue } from '@/utils/loanOverdue';

import { type Loan, LoanStatus, RepaymentStatus } from '@/types/loanTypes';

export const REQUEST_EXPIRATION_DAYS = 7;
const REQUEST_EXPIRATION_MS = REQUEST_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;

type CreditUsageLoan = Pick<Loan, 'createdAt' | 'loanAmount' | 'loanStatus' | 'repaymentStatus'>;

export const isExpiredUnfundedRequest = (loan: Pick<Loan, 'createdAt' | 'loanStatus'>, now = new Date()) => {
   if (loan.loanStatus !== LoanStatus.REQUESTED) return false;
   if (!loan.createdAt) return false;

   return parseDateSafely(loan.createdAt).getTime() + REQUEST_EXPIRATION_MS <= now.getTime();
};

export const isLoanUsingBorrowerCredit = (loan: CreditUsageLoan, now = new Date()) => {
   if (loan.loanStatus === LoanStatus.REQUESTED) {
      return !isExpiredUnfundedRequest(loan, now);
   }

   return loan.loanStatus === LoanStatus.LENT && loan.repaymentStatus !== RepaymentStatus.PAID;
};

// Callers sometimes pass overlapping lists (an overdue loan is also an active loan), so count each loan once.
export const getBorrowerUsedCreditAmount = (loans: CreditUsageLoan[], now = new Date()) =>
   [...new Set(loans)].filter((loan) => isLoanUsingBorrowerCredit(loan, now)).reduce((sum, loan) => sum + Number(loan.loanAmount || 0), 0);

export const getBorrowerActiveLoanCount = (loans: CreditUsageLoan[], now = new Date()) =>
   loans.filter((loan) => isLoanUsingBorrowerCredit(loan, now)).length;

/**
 * A request whose repayment day is already over: funding it now would create a loan that is overdue
 * the moment it starts. Measured with the same deadline as everything else (getLoanPastDueAt).
 */
export const isRequestPastItsDueDay = (loan: Partial<Pick<Loan, 'dueDate' | 'dueTimezone' | 'loanStatus'>>, now = new Date()) =>
   loan.loanStatus === LoanStatus.REQUESTED && isLoanPastDue(loan.dueDate, now, loan.dueTimezone);

/**
 * Shown on the request board: not expired, not on hold, and its due day not yet over. A request on
 * hold (the borrower missed their video call) or past its due day is hidden from everyone but its
 * borrower, who can still see it (and delete it to post a new one).
 */
export const isRequestBoardLoanVisible = (
   loan: Pick<Loan, 'createdAt' | 'loanStatus'> & Partial<Pick<Loan, 'onHoldSince' | 'borrowerUser' | 'dueDate' | 'dueTimezone'>>,
   now = new Date(),
   viewerUserId?: string | null
) => {
   if (isExpiredUnfundedRequest(loan, now)) return false;
   if (Boolean(viewerUserId) && loan.borrowerUser === viewerUserId) return true;
   return !loan.onHoldSince && !isRequestPastItsDueDay(loan, now);
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type RequestBoardExpiry = { postedAt: Date; expiresAt: Date; daysRemaining: number; hoursRemaining: number };

export const getRequestBoardExpiry = (loan: Pick<Loan, 'createdAt' | 'loanStatus'>, now = new Date()): RequestBoardExpiry | null => {
   if (loan.loanStatus !== LoanStatus.REQUESTED || !loan.createdAt) return null;

   const createdAt = parseDateSafely(loan.createdAt);
   if (Number.isNaN(createdAt.getTime())) return null;

   const expiresAt = new Date(createdAt.getTime() + REQUEST_EXPIRATION_MS);
   const msRemaining = expiresAt.getTime() - now.getTime();
   if (msRemaining <= 0) return null;

   // Floor the day count so a request with 3d 2h left never reads as "4 days" — the
   // deadline is real and lenders act on it, so it must not be overstated.
   return {
      postedAt: createdAt,
      expiresAt,
      daysRemaining: Math.floor(msRemaining / DAY_MS),
      hoursRemaining: Math.max(1, Math.ceil(msRemaining / HOUR_MS))
   };
};

export const formatBoardExpiryLabel = ({ postedAt, daysRemaining }: RequestBoardExpiry) => {
   // "Less than a day" (not "leaves today") because the final <24h can span midnight.
   const dayLabel = daysRemaining < 1 ? 'Less than a day' : daysRemaining === 1 ? '1 day' : `${daysRemaining} days`;

   return `Posted ${format(postedAt, 'EEE, MMM d')} · ${dayLabel} left on the board`;
};
