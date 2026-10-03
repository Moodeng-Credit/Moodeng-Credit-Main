import { dueDayBounds, isUsableTimezone } from './loanDeadline.ts';

export type TrustPointRewardLoan = {
   id?: string | null;
   borrower_user_id?: string | null;
   loan_amount?: number | string | null;
   total_repayment_amount?: number | string | null;
   repaid_amount?: number | string | null;
   due_date?: string | null;
   funded_at?: string | null;
   lender_user_id?: string | null;
   loan_status?: string | null;
   repayment_status?: string | null;
   repaid_at?: string | null;
   refunded_at?: string | null;
   is_test?: boolean | null;
   due_timezone?: string | null;
   // Borrower's limit when the loan was fully repaid (confirm-loan-payment); principal >= this = full-limit.
   credit_limit_at_repayment?: number | string | null;
   updated_at?: string | null;
};

export type TrustPointRewardUser = {
   cs?: number | string | null;
   is_world_id?: string | boolean | null;
   is_didit?: string | boolean | null;
};

export type TrustPointMilestoneDefinition = {
   id: string;
   points_awarded: number | string | bigint;
   is_active?: boolean | null;
};

type EligibilityByMilestone = Record<string, boolean>;

const CREDIT_TIERS = [15, 20, 40, 60, 80, 100, 120, 140];
const MAX_CREDIT_LIMIT = CREDIT_TIERS[CREDIT_TIERS.length - 1];

const toNumber = (value: number | string | null | undefined) => {
   const numberValue = Number(value ?? 0);
   return Number.isFinite(numberValue) ? numberValue : 0;
};

const toBigInt = (value: number | string | bigint | null | undefined) => {
   if (typeof value === 'bigint') return value;
   if (typeof value === 'number') return Number.isFinite(value) ? BigInt(Math.trunc(value)) : 0n;

   const normalized = String(value ?? '').trim();
   if (!normalized) return 0n;

   const numeric = normalized.split('.')[0];
   return /^-?\d+$/.test(numeric) ? BigInt(numeric) : 0n;
};

const toDateMs = (dateValue: string | null | undefined) => {
   const parsedDate = dateValue ? new Date(dateValue) : null;
   const time = parsedDate?.getTime() ?? Number.NaN;
   return Number.isNaN(time) ? null : time;
};

// Mirrors app_private.is_loan_fully_repaid / is_loan_repaid_on_time in the database: a refund reads
// back as 'Paid' (platform settlement even stamps repaid_amount to the total) but the borrower
// defaulted, so refunded and test loans never count as repayments.
const isPaid = (loan: TrustPointRewardLoan) => loan.repayment_status === 'Paid' && !loan.refunded_at && !loan.is_test;

// Due dates are stored at midnight UTC; a loan stays on time through the whole due date.
const OVERDUE_AFTER_DUE_DATE_MS = 24 * 60 * 60 * 1000;

// When the loan was repaid. updated_at alone is unreliable: any later edit (interest return, admin
// fixes) bumps it.
const getPaidAtMs = (loan: TrustPointRewardLoan) => toDateMs(loan.repaid_at ?? loan.updated_at);

const isFullyRepaid = (loan: TrustPointRewardLoan) => {
   const totalRepayment = toNumber(loan.total_repayment_amount);
   const repaidAmount = toNumber(loan.repaid_amount);

   return totalRepayment > 0 ? repaidAmount >= totalRepayment : repaidAmount > 0;
};

// The moment a loan is past due: the LATER of due_date + 24h and the end of the due day in the loan's
// zone. Same as app_private.loan_past_due_at and the app's getLoanPastDueAt.
const pastDueAtMs = (loan: TrustPointRewardLoan): number | null => {
   const dueAt = toDateMs(loan.due_date);
   if (dueAt === null || !loan.due_date) return null;
   const zone = isUsableTimezone(loan.due_timezone) ? loan.due_timezone : 'Asia/Manila';
   return Math.max(dueAt + OVERDUE_AFTER_DUE_DATE_MS, dueDayBounds(loan.due_date, zone).end.getTime());
};

const isPaidOnTime = (loan: TrustPointRewardLoan) => {
   if (!isPaid(loan) || !isFullyRepaid(loan)) {
      return false;
   }

   const paidAt = getPaidAtMs(loan);
   const dueAt = toDateMs(loan.due_date);
   if (paidAt === null || dueAt === null || !loan.due_date) return false;

   // Same as app_private.is_loan_repaid_on_time: before the LATER of due_date + 24h and the end of the
   // due day in the loan's own zone, so it's never stricter than before and never stricter than the app.
   const zone = isUsableTimezone(loan.due_timezone) ? loan.due_timezone : 'Asia/Manila';
   const deadline = Math.max(dueAt + OVERDUE_AFTER_DUE_DATE_MS, dueDayBounds(loan.due_date, zone).end.getTime());
   return paidAt < deadline;
};

// Full-limit loans: principal at or above the limit recorded when the loan was repaid. The limit is
// recorded atomically with the repayment (public.record_loan_payment) and older loans were backfilled, so
// a loan without one (the borrower was unverified when they repaid) is not a full-limit loan. Same as
// private.is_trust_milestone_complete.
const hasRecordedLimit = (loan: TrustPointRewardLoan) =>
   loan.credit_limit_at_repayment !== null && loan.credit_limit_at_repayment !== undefined && loan.credit_limit_at_repayment !== '';

const getFullLimitLoans = (paidLoans: TrustPointRewardLoan[]) => {
   const fullLimitLoans = new Set<TrustPointRewardLoan>();
   for (const loan of paidLoans.filter(isFullyRepaid)) {
      if (hasRecordedLimit(loan) && toNumber(loan.loan_amount) >= toNumber(loan.credit_limit_at_repayment)) fullLimitLoans.add(loan);
   }
   return fullLimitLoans;
};

const isVerifiedUser = (user: TrustPointRewardUser) =>
   user.is_world_id === true || user.is_world_id === 'ACTIVE' || user.is_didit === true || user.is_didit === 'ACTIVE';

const getEligibilityByMilestone = (
   loans: TrustPointRewardLoan[],
   user: TrustPointRewardUser,
   referenceDate: Date
): EligibilityByMilestone => {
   const fundedLoans = loans.filter((loan) => loan.loan_status === 'Lent');
   const onTimePaidLoans = loans.filter(isPaidOnTime);
   const paidLoans = loans.filter(isPaid);
   const uniqueLenderCount = new Set(fundedLoans.map((loan) => loan.lender_user_id).filter(Boolean)).size;
   const totalRepaid = paidLoans.reduce((sum, loan) => sum + toNumber(loan.repaid_amount), 0);
   const hasUnresolvedDefault = fundedLoans.some((loan) => {
      if (loan.repayment_status === 'Paid') {
         return false;
      }

      const pastDueAt = pastDueAtMs(loan);
      return pastDueAt !== null && referenceDate.getTime() >= pastDueAt;
   });
   const fullLimitLoans = getFullLimitLoans(paidLoans);
   const creditLimit = toNumber(user.cs);
   const isVerified = isVerifiedUser(user);

   return {
      'verify-identity': isVerified,
      'first-loan-request': loans.length > 0,
      'first-funded-loan': fundedLoans.length >= 1,
      'first-on-time-repayment': onTimePaidLoans.length >= 1,
      'two-on-time-streak': onTimePaidLoans.length >= 2,
      'full-limit-credit-builder': onTimePaidLoans.some((loan) => fullLimitLoans.has(loan)),
      'two-unique-lenders': uniqueLenderCount >= 2,
      'repay-100-total': totalRepaid >= 100,
      'reach-level-three': isVerified && creditLimit >= 40,
      'trusted-borrower-candidate': onTimePaidLoans.length >= 5 && uniqueLenderCount >= 3 && !hasUnresolvedDefault
   };
};

export const markLoansRepaid = (loans: TrustPointRewardLoan[], loanIds: string[], paidAt: Date) => {
   const repayLoanIds = new Set(loanIds);
   const paidAtValue = paidAt.toISOString();

   return loans.map((loan) =>
      loan.id && repayLoanIds.has(loan.id)
         ? {
              ...loan,
              repayment_status: 'Paid',
              repaid_amount: loan.total_repayment_amount ?? loan.repaid_amount ?? 0,
              repaid_at: paidAtValue,
              updated_at: paidAtValue
           }
         : loan
   );
};

export const markLoansUnpaid = (loans: TrustPointRewardLoan[], loanIds: string[]) => {
   const unpaidLoanIds = new Set(loanIds);

   return loans.map((loan) =>
      loan.id && unpaidLoanIds.has(loan.id)
         ? {
              ...loan,
              repayment_status: 'Unpaid',
              repaid_amount: 0,
              repaid_at: null,
              updated_at: loan.funded_at ?? loan.due_date ?? null
           }
         : loan
   );
};

export const calculateTrustPointRewardDelta = ({
   beforeLoans,
   afterLoans,
   user,
   milestoneDefinitions,
   completedMilestoneIds,
   referenceDate
}: {
   beforeLoans: TrustPointRewardLoan[];
   afterLoans: TrustPointRewardLoan[];
   user: TrustPointRewardUser;
   milestoneDefinitions: TrustPointMilestoneDefinition[];
   completedMilestoneIds?: Set<string>;
   referenceDate: Date;
}) => {
   // A loan this projection marks repaid hasn't had its limit recorded yet: record the borrower's
   // current limit on it, as record_loan_payment will (an unverified borrower has none).
   const paidBefore = new Set(beforeLoans.filter((loan) => isPaid(loan) && isFullyRepaid(loan)).map((loan) => loan.id).filter(Boolean));
   const currentLimit = Math.min(Math.max(toNumber(user.cs), CREDIT_TIERS[0]), MAX_CREDIT_LIMIT);
   const projectedAfter = afterLoans.map((loan) =>
      isVerifiedUser(user) && loan.id && !paidBefore.has(loan.id) && isPaid(loan) && isFullyRepaid(loan) && !hasRecordedLimit(loan)
         ? { ...loan, credit_limit_at_repayment: currentLimit }
         : loan
   );
   const beforeEligibility = getEligibilityByMilestone(beforeLoans, user, referenceDate);
   const afterEligibility = getEligibilityByMilestone(projectedAfter, user, referenceDate);
   const alreadyCompleted = completedMilestoneIds ?? new Set<string>();

   return milestoneDefinitions
      .filter((milestone) => milestone.is_active !== false)
      .reduce((sum, milestone) => {
         if (alreadyCompleted.has(milestone.id) || beforeEligibility[milestone.id] || !afterEligibility[milestone.id]) {
            return sum;
         }

         return sum + toBigInt(milestone.points_awarded);
      }, 0n)
      .toString();
};
