// Server-side port of the credit-progression + funding-points math that used to run client-side
// in src/store/slices/loanSlice.ts. Kept in sync with:
//   - src/lib/creditLeveling.ts        (evaluateCreditProgression, getEffectiveCreditLimit)
//   - src/config/creditTiers.ts        (CREDIT_TIERS, getNextCreditTier)
//   - src/shared/points.ts             (computeYearOneIouPointsDelta, getYearOneIouBorrowerBonusPoints)
//   - src/utils/decimalHelpers.ts      (toNumber)
//   - src/utils/dateFormatters.ts      (parseDateSafely)
// If any of those change, change this too. These are pure functions — no Supabase/Deno deps — so
// they can be unit-tested in isolation.

// --- small utils (ported) ---------------------------------------------------------------------

export const toNumber = (value: number | string | null | undefined): number => {
   if (value === null || value === undefined) return 0;
   if (typeof value === 'number') return value;
   const parsed = Number(value);
   return Number.isNaN(parsed) ? 0 : parsed;
};

export const parseDateSafely = (dateValue: string | Date): Date => {
   if (dateValue instanceof Date) return dateValue;
   const date = new Date(dateValue);
   return Number.isNaN(date.getTime()) ? new Date() : date;
};

// --- credit tiers (ported from src/config/creditTiers.ts) --------------------------------------

export const CREDIT_TIERS = [15, 20, 40, 60, 80, 100, 120, 140] as const;
export const STARTING_CREDIT_LIMIT = CREDIT_TIERS[0];
export const MAX_CREDIT_LIMIT = CREDIT_TIERS[CREDIT_TIERS.length - 1];

export const getNextCreditTier = (currentAmount: number): number => {
   const currentTierIndex = CREDIT_TIERS.findIndex((tier) => tier >= currentAmount);
   if (currentTierIndex < 0) return MAX_CREDIT_LIMIT;
   return CREDIT_TIERS[Math.min(currentTierIndex + 1, CREDIT_TIERS.length - 1)];
};

// --- credit progression (ported from src/lib/creditLeveling.ts) --------------------------------

export const getEffectiveCreditLimit = (cs: number | null | undefined, isVerified: boolean): number => {
   if (!isVerified) return 0;
   return Math.min(Math.max(toNumber(cs ?? 0), STARTING_CREDIT_LIMIT), MAX_CREDIT_LIMIT);
};

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
   const isLate = paidAtDate.getTime() > dueDateValue.getTime();
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

// --- funding points (ported from src/shared/points.ts) -----------------------------------------

const POINTS_SCALE = 6;
const LOAN_FUNDING_POINTS_MULTIPLIER = 1n;
const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

const parseAmountToMinorUnits = (amount: string | number): bigint => {
   const normalized = typeof amount === 'number' ? amount.toString() : amount.trim();
   if (normalized.length === 0 || normalized.includes('e') || normalized.includes('E')) {
      throw new Error('Loan amount must be a base-10 number');
   }
   if (!DECIMAL_PATTERN.test(normalized)) {
      throw new Error('Loan amount must be a positive number');
   }
   const [whole, fraction = ''] = normalized.split('.');
   if (fraction.length > POINTS_SCALE) {
      throw new Error(`Loan amount must have at most ${POINTS_SCALE} decimal places`);
   }
   const paddedFraction = fraction.padEnd(POINTS_SCALE, '0');
   const scaleFactor = 10n ** BigInt(POINTS_SCALE);
   return BigInt(whole) * scaleFactor + BigInt(paddedFraction || '0');
};

const pointsMajorToMinor = (points: number): bigint => BigInt(Math.trunc(points)) * 10n ** BigInt(POINTS_SCALE);

export const LOAN_FUNDING_POINTS_PER_USDC = 1;

export const getYearOneIouBorrowerBonusPoints = (borrowerPriorFundedLoanCount: number): number => {
   const priorFundedLoans = Math.max(0, Math.trunc(borrowerPriorFundedLoanCount));
   if (priorFundedLoans === 0) return 25;
   if (priorFundedLoans === 1) return 20;
   if (priorFundedLoans === 2) return 15;
   return 10;
};

export const computeYearOneIouPointsDelta = (loanAmount: string | number, borrowerPriorFundedLoanCount: number): bigint => {
   const base = parseAmountToMinorUnits(loanAmount) * LOAN_FUNDING_POINTS_MULTIPLIER;
   return base + pointsMajorToMinor(getYearOneIouBorrowerBonusPoints(borrowerPriorFundedLoanCount));
};

// Cumulative amount of a borrower's on-time, fully-repaid loans (used for credit level-up volume
// gate). Ported from the inline reducer in loanSlice.ts. `loans` are the borrower's rows.
export const computeCumulativeBorrowedAmount = (
   loans: Array<{
      loan_amount: number | string | null;
      repaid_amount: number | string | null;
      total_repayment_amount: number | string | null;
      due_date: string | null;
      repaid_at: string | null;
      updated_at: string | null;
   }>
): number =>
   loans.reduce((sum, loan) => {
      const paidAtSource = loan.repaid_at ?? loan.updated_at;
      if (!loan.due_date || !paidAtSource) return sum;
      const repaid = toNumber(loan.repaid_amount ?? 0);
      const totalRepayment = toNumber(loan.total_repayment_amount ?? 0);
      const isFullyRepaid = totalRepayment > 0 ? repaid >= totalRepayment : repaid > 0;
      if (!isFullyRepaid) return sum;
      const paidAt = parseDateSafely(paidAtSource);
      const dueDate = parseDateSafely(loan.due_date);
      const isOnTime = paidAt.getTime() <= dueDate.getTime();
      return isOnTime ? sum + toNumber(loan.loan_amount ?? 0) : sum;
   }, 0);
