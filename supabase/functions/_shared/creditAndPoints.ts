// Server-side port of the credit-progression + funding-points math that used to run client-side
// in src/store/slices/loanSlice.ts. Kept in sync with:
//   - src/lib/creditLeveling.ts        (evaluateCreditProgression, getEffectiveCreditLimit)
//   - src/config/creditTiers.ts        (CREDIT_TIERS, getNextCreditTier)
//   - src/shared/points.ts             (computeYearOneIouPointsDelta, getYearOneIouBorrowerBonusPoints)
//   - src/utils/decimalHelpers.ts      (toNumber)
//   - src/utils/dateFormatters.ts      (parseDateSafely)
// If any of those change, change this too. These are pure functions — no Supabase/Deno deps — so
// they can be unit-tested in isolation.
import { DEFAULT_TIMEZONE, isUsableTimezone, pastDueAt, zonedMidnightUtc } from './loanDeadline.ts';

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

// Kept in sync with src/lib/creditLeveling.ts isRepaidOnTime: on time = paid before the end of the
// due day on the borrower's clock (the loan's saved zone, else Manila). Same as pastDueAt.
export const isRepaidOnTime = (paidAt: string | Date, dueDate: string | Date, dueTimezone?: string | null): boolean =>
   parseDateSafely(paidAt).getTime() <
   pastDueAt(parseDateSafely(dueDate), isUsableTimezone(dueTimezone) ? dueTimezone : DEFAULT_TIMEZONE).getTime();

// --- credit tiers (ported from src/config/creditTiers.ts) --------------------------------------

// $15, $25, $35, $45 … (+$10 a level), top $135 (never named to borrowers).
export const STARTING_CREDIT_LIMIT = 15;
export const CREDIT_STEP = 10;
export const MAX_CREDIT_LIMIT = 135;
export const CREDIT_TIERS: readonly number[] = Array.from(
   { length: (MAX_CREDIT_LIMIT - STARTING_CREDIT_LIMIT) / CREDIT_STEP + 1 },
   (_, i) => STARTING_CREDIT_LIMIT + i * CREDIT_STEP
);

// The ladder before 2026-11-14 10:00 Bangkok. Track A (joined before 2026-10-01 Bangkok) stays on it for good
// (George, 2026-11-22); Track B (everyone else) uses CREDIT_TIERS, so an old $20 goes to $25. Same as src/config/creditTiers.ts.
export const OLD_CREDIT_TIERS: readonly number[] = [15, 20, 40, 60, 80, 100, 120, 140];
export const LADDER_SWITCH_AT = Date.parse('2026-11-14T10:00:00+07:00');
export type CreditTrack = 'A' | 'B';
export const TRACK_A_JOINED_BEFORE = Date.parse('2026-10-01T00:00:00+07:00');

export const getCreditTrack = (joinedAt?: string | number | Date | null): CreditTrack => {
   const joined = joinedAt == null ? Number.NaN : new Date(joinedAt).getTime();
   return Number.isFinite(joined) && joined < TRACK_A_JOINED_BEFORE ? 'A' : 'B';
};

// A Track B full-limit loan funded before the switch at an old limit still gets the old step once ($20 → $40),
// then +$10 ($40 → $45) (George, 2026-11-22).
export const getNextCreditTier = (
   currentAmount: number,
   joinedAt?: string | number | Date | null,
   fundedAt?: string | number | Date | null
): number => {
   const funded = fundedAt == null ? Number.NaN : new Date(fundedAt).getTime();
   const promisedOldStep = Number.isFinite(funded) && funded < LADDER_SWITCH_AT && !CREDIT_TIERS.includes(currentAmount);
   const ladder = promisedOldStep || getCreditTrack(joinedAt) === 'A' ? OLD_CREDIT_TIERS : CREDIT_TIERS;
   const next = ladder.find((tier) => tier > currentAmount);
   return Math.min(next ?? MAX_CREDIT_LIMIT, MAX_CREDIT_LIMIT);
};

/**
 * Income ladders (George, 2026-11-27: "connect their income to the credit ladder"). Low or no income
 * (income ceiling $35, app_private.limit_ceiling) climbs in $3 steps: $15 → $18 → $21 … → $35, and their
 * repayment counts from day 7 of the loan (LOW_INCOME_COUNTS_AFTER_DAYS) instead of the 2nd half, since
 * they get paid weekly or irregularly ("they will probably repay after a week or so"). Everyone
 * else keeps the normal $10 steps. Every ladder stops at the borrower's ceiling ($60 by default, $140 with
 * team-approved proof of ₱23k+/month). Borrowers only ever see their own next number, never the tiers.
 * The $5 steps apply to Track B loans funded from INCOME_LADDER_FROM (and to "what's next" when no loan is
 * out); a loan already running keeps the step it was shown, capped at the ceiling. Never lowers a limit.
 * Kept in sync between src/config/creditTiers.ts and supabase/functions/_shared/creditAndPoints.ts.
 */
export const INCOME_LADDER_FROM = Date.parse('2026-11-28T00:00:00+07:00');
export const LOW_INCOME_CEILING = 35;
export const LOW_INCOME_LADDER: readonly number[] = [15, 18, 21, 24, 27, 30, 33, 35];
export const LOW_INCOME_COUNTS_AFTER_DAYS = 7;

/** The next limit after a full-limit loan, on the borrower's income ladder and never past their ceiling. */
export const getIncomeNextLimit = (
   currentAmount: number,
   ceiling: number | null | undefined,
   joinedAt?: string | number | Date | null,
   fundedAt?: string | number | Date | null
): number => {
   const trackNext = getNextCreditTier(currentAmount, joinedAt, fundedAt);
   if (!ceiling || !Number.isFinite(ceiling) || ceiling <= 0) return trackNext;
   const funded = fundedAt == null ? Number.NaN : new Date(fundedAt).getTime();
   const smallSteps =
      ceiling <= LOW_INCOME_CEILING && getCreditTrack(joinedAt) === 'B' && (!Number.isFinite(funded) || funded >= INCOME_LADDER_FROM);
   const next = smallSteps ? (LOW_INCOME_LADDER.find((tier) => tier > currentAmount) ?? currentAmount) : trackNext;
   return Math.max(currentAmount, Math.min(next, ceiling, MAX_CREDIT_LIMIT));
};

// Admin "one level up / down" (Directory card): the next step on the borrower's track above or below the
// current limit, clamped to $15–$135. An off-ladder limit snaps to the nearest step in that direction.
// Returns the current limit when already at the end of the ladder.
export const shiftCreditLevel = (cs: number | null | undefined, direction: 'up' | 'down', joinedAt?: string | null): number => {
   const current = Math.min(Math.max(Number(cs ?? 0) || 0, STARTING_CREDIT_LIMIT), MAX_CREDIT_LIMIT);
   const ladder = (getCreditTrack(joinedAt) === 'A' ? OLD_CREDIT_TIERS : CREDIT_TIERS).filter((tier) => tier <= MAX_CREDIT_LIMIT);
   if (direction === 'up') return ladder.find((tier) => tier > current) ?? (current < MAX_CREDIT_LIMIT ? MAX_CREDIT_LIMIT : current);
   return [...ladder].reverse().find((tier) => tier < current) ?? current;
};

// --- credit progression (ported from src/lib/creditLeveling.ts) --------------------------------

export const getEffectiveCreditLimit = (cs: number | null | undefined, isVerified: boolean): number => {
   if (!isVerified) return 0;
   return Math.min(Math.max(toNumber(cs ?? 0), STARTING_CREDIT_LIMIT), MAX_CREDIT_LIMIT);
};

type CreditProgressionInput = {
   currentLimit: number | null | undefined;
   isVerified: boolean;
   repaidAmount: number | null | undefined;
   totalRepaymentAmount: number | null | undefined;
   /** Principal the borrower requested on the loan just repaid (not the repayment total). */
   loanAmount: number | null | undefined;
   dueDate: string;
   /** The loan's saved zone (`loans.due_timezone`); Manila when missing. */
   dueTimezone?: string | null;
   paidAt: string;
   /** When the loan was funded: the 48-hour rule, and a pre-Nov-14 loan's promised old step. */
   fundedAt?: string | null;
   /** When the borrower joined (users.created_at): before October 2026 = Track A, the old ladder. */
   joinedAt?: string | null;
   /** Income ceiling $35 (Track B): their repayment counts from day 7 instead of the 2nd half. */
   lowIncome?: boolean;
};

type CreditProgressionResult = {
   shouldLevelUp: boolean;
   nextLimit: number;
   isLate: boolean;
   isFullyRepaid: boolean;
};

// A loan repaid within 48 hours of getting it doesn't count (George, 2026-11-18): no level-up, no
// affiliate $5, no food voucher. People were borrowing for 30 days and repaying on day 1–2 to climb fast.
export const FAST_REPAY_HOURS = 48;
export const isFastRepay = (fundedAt: string | null | undefined, paidAt: string | null | undefined) => {
   const funded = fundedAt ? Date.parse(fundedAt) : NaN;
   const paid = paidAt ? Date.parse(paidAt) : NaN;
   return Number.isFinite(funded) && Number.isFinite(paid) && paid - funded < FAST_REPAY_HOURS * 3_600_000;
};

// One rule since 2026-11-27 (George): a repayment grows the limit only in the loan's SECOND HALF — from
// 00:00 (loan's zone) on its halfway day, never sooner than 48h after funding. Same window as food
// vouchers (app_private.loan_reward_from_at), and it always holds a 15th or 30th payday. Loans funded
// before the switch keep the 48-hour rule they were shown. Kept in sync with src/lib/creditLeveling.ts.
export const SECOND_HALF_RULE_FROM = Date.parse('2026-11-27T00:00:00+07:00');

/**
 * When paying this loan starts to grow the limit. Null when the loan has no funding time.
 * Loans funded before SECOND_HALF_RULE_FROM: 48h. Low income (`lowIncome`, ceiling $35) loans funded from
 * INCOME_LADDER_FROM: day 7. Everyone else: the 2nd half.
 */
export const countsFromAt = (
   fundedAt: string | null | undefined,
   dueDate?: string | Date | null,
   dueTimezone?: string | null,
   opts: { lowIncome?: boolean } = {}
): Date | null => {
   const funded = fundedAt ? Date.parse(fundedAt) : NaN;
   if (!Number.isFinite(funded)) return null;
   const fast = funded + FAST_REPAY_HOURS * 3_600_000;
   if (funded < SECOND_HALF_RULE_FROM) return new Date(fast);
   if (opts.lowIncome && funded >= INCOME_LADDER_FROM) return new Date(funded + LOW_INCOME_COUNTS_AFTER_DAYS * 86_400_000);
   return secondHalfStartAt(fundedAt, dueDate, dueTimezone) ?? new Date(fast);
};

/**
 * 00:00 (loan's zone) on the loan's halfway day, never sooner than 48h after funding: the start of its
 * "2nd half", the best days to pay. Mirrors app_private.loan_reward_from_at. Null without both dates.
 */
export const secondHalfStartAt = (
   fundedAt: string | null | undefined,
   dueDate?: string | Date | null,
   dueTimezone?: string | null
): Date | null => {
   const funded = fundedAt ? Date.parse(fundedAt) : NaN;
   if (!Number.isFinite(funded) || !dueDate || Number.isNaN(new Date(dueDate).getTime())) return null;
   const zone = isUsableTimezone(dueTimezone) ? dueTimezone : DEFAULT_TIMEZONE;
   const halfway = new Date(funded + (pastDueAt(dueDate, zone).getTime() - funded) / 2);
   const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(
      halfway
   );
   const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
   const dayStart = zonedMidnightUtc(get('year'), get('month'), get('day'), zone).getTime();
   return new Date(Math.max(dayStart, funded + FAST_REPAY_HOURS * 3_600_000));
};

/** True when paying at `paidAt` is too early to grow the limit (before `countsFromAt`). */
export const isTooEarlyRepay = (
   fundedAt: string | null | undefined,
   paidAt: string | null | undefined,
   dueDate?: string | Date | null,
   dueTimezone?: string | null,
   opts: { lowIncome?: boolean } = {}
) => {
   const from = countsFromAt(fundedAt, dueDate, dueTimezone, opts);
   const paid = paidAt ? Date.parse(paidAt) : NaN;
   return from !== null && Number.isFinite(paid) && paid < from.getTime();
};

export const evaluateCreditProgression = ({
   currentLimit,
   isVerified,
   repaidAmount,
   totalRepaymentAmount,
   loanAmount,
   dueDate,
   dueTimezone,
   paidAt,
   fundedAt,
   joinedAt,
   lowIncome = false
}: CreditProgressionInput): CreditProgressionResult => {
   const normalizedLimit = getEffectiveCreditLimit(currentLimit, isVerified);
   const repaid = toNumber(repaidAmount ?? 0);
   const totalRepayment = toNumber(totalRepaymentAmount ?? 0);
   const principal = toNumber(loanAmount ?? 0);
   const isFullyRepaid = totalRepayment > 0 && repaid >= totalRepayment;
   const isLate = !isRepaidOnTime(paidAt, dueDate, dueTimezone);
   // Only a full-limit loan levels you up: request at least your current limit, then repay it in full.
   // A smaller request is a trust-building loan and never levels up, even when principal + interest
   // reaches the limit or several small loans add up to it. Lateness doesn't block it: most late
   // repayments are tech trouble (wallets, exchanges), not the borrower's fault.
   const isFullLimitLoan = principal >= normalizedLimit;
   const tooFast = isTooEarlyRepay(fundedAt, paidAt, dueDate, dueTimezone, { lowIncome });
   const canLevelUp = isVerified && isFullyRepaid && isFullLimitLoan && normalizedLimit < MAX_CREDIT_LIMIT && !tooFast;

   return {
      shouldLevelUp: canLevelUp,
      nextLimit: getNextCreditTier(normalizedLimit, joinedAt, fundedAt),
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
