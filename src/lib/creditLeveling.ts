import { CREDIT_TIERS, MAX_CREDIT_LIMIT, STARTING_CREDIT_LIMIT, getNextCreditTier } from '@/config/creditTiers';
import { parseDateSafely } from '@/utils/dateFormatters';
import { toNumber } from '@/utils/decimalHelpers';

export const CREDIT_STEP = 20;
export const MIN_CREDIT_LIMIT = STARTING_CREDIT_LIMIT;
export { CREDIT_TIERS, MAX_CREDIT_LIMIT };

type CreditProgressionInput = {
   currentLimit: number | null | undefined;
   isVerified: boolean;
   isPaused: boolean;
   repaidAmount: number | null | undefined;
   totalRepaymentAmount: number | null | undefined;
   cumulativeBorrowedAmount: number | null | undefined;
   dueDate: string;
   paidAt: string;
};

type CreditProgressionResult = {
   shouldPause: boolean;
   shouldLevelUp: boolean;
   nextLimit: number;
   isLate: boolean;
   isFullyRepaid: boolean;
};

export const getEffectiveCreditLimit = (cs: number | null | undefined, isVerified: boolean): number => {
   if (!isVerified) return 0;
   return Math.min(Math.max(toNumber(cs ?? 0), MIN_CREDIT_LIMIT), MAX_CREDIT_LIMIT);
};

export const evaluateCreditProgression = ({
   currentLimit,
   isVerified,
   isPaused,
   repaidAmount,
   totalRepaymentAmount,
   cumulativeBorrowedAmount,
   dueDate,
   paidAt
}: CreditProgressionInput): CreditProgressionResult => {
   const normalizedLimit = getEffectiveCreditLimit(currentLimit, isVerified);
   const repaid = toNumber(repaidAmount ?? 0);
   const totalRepayment = toNumber(totalRepaymentAmount ?? 0);
   const cumulativeBorrowed = toNumber(cumulativeBorrowedAmount ?? 0);
   const isFullyRepaid = totalRepayment > 0 && repaid >= totalRepayment;
   const paidAtDate = parseDateSafely(paidAt);
   const dueDateValue = parseDateSafely(dueDate);
   // Due dates are stored at midnight UTC. A loan is on time through the entire due date and only
   // becomes overdue the day AFTER the due date (a loan due the 15th is overdue starting the 16th).
   const OVERDUE_AFTER_DUE_DATE_MS = 24 * 60 * 60 * 1000;
   const isLate = paidAtDate.getTime() >= dueDateValue.getTime() + OVERDUE_AFTER_DUE_DATE_MS;
   const meetsCumulativeVolume = cumulativeBorrowed >= normalizedLimit;
   const shouldPause = isLate;
   const canLevelUp =
      isVerified && !isPaused && !shouldPause && isFullyRepaid && meetsCumulativeVolume && normalizedLimit < MAX_CREDIT_LIMIT;

   return {
      shouldPause,
      shouldLevelUp: canLevelUp,
      nextLimit: getNextCreditTier(normalizedLimit),
      isLate,
      isFullyRepaid
   };
};
