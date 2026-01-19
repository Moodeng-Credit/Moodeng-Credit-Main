import { parseDateSafely } from '@/utils/dateFormatters';
import { toNumber } from '@/utils/decimalHelpers';

export const CREDIT_STEP = 20;
export const MIN_CREDIT_LIMIT = 20;
export const MAX_CREDIT_LIMIT = 140;
export const CREDIT_TIERS = [20, 40, 60, 80, 100, 120, 140] as const;

type CreditProgressionInput = {
   currentLimit: number | null | undefined;
   isVerified: boolean;
   isPaused: boolean;
   loanAmount: number | null | undefined;
   repaidAmount: number | null | undefined;
   totalRepaymentAmount: number | null | undefined;
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
   loanAmount,
   repaidAmount,
   totalRepaymentAmount,
   dueDate,
   paidAt
}: CreditProgressionInput): CreditProgressionResult => {
   const normalizedLimit = getEffectiveCreditLimit(currentLimit, isVerified);
   const normalizedLoanAmount = toNumber(loanAmount ?? 0);
   const repaid = toNumber(repaidAmount ?? 0);
   const totalRepayment = toNumber(totalRepaymentAmount ?? 0);
   const isFullyRepaid = totalRepayment > 0 && repaid >= totalRepayment;
   const paidAtDate = parseDateSafely(paidAt);
   const dueDateValue = parseDateSafely(dueDate);
   const isLate = paidAtDate.getTime() > dueDateValue.getTime();
   const matchesLimit = normalizedLoanAmount === normalizedLimit;
   const shouldPause = isLate;
   const canLevelUp =
      isVerified && !isPaused && !shouldPause && isFullyRepaid && matchesLimit && normalizedLimit < MAX_CREDIT_LIMIT;

   return {
      shouldPause,
      shouldLevelUp: canLevelUp,
      nextLimit: Math.min(normalizedLimit + CREDIT_STEP, MAX_CREDIT_LIMIT),
      isLate,
      isFullyRepaid
   };
};
