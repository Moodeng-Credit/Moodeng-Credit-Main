import { toNumber } from '@/utils/decimalHelpers';

import { getIncomeNextLimit } from '@/config/creditTiers';
import { countsFromAt, evaluateCreditProgression, getEffectiveCreditLimit } from '@/lib/creditLeveling';
import type { RepayStreak } from '@/lib/friendReferrals';
import { getDaysUntilDueDay, getDueDayEnd, getLoanTimezone, getRewardFromAt } from '@/lib/loanDeadline';
import { currentDueDate } from '@/lib/repaymentSchedule';
import type { Loan } from '@/types/loanTypes';
import { getRepayRewardLabel, getRepayRewardLine, getRewardWindow } from '@/views/dashboard-v2/dashboardV2Model';

// "Before you repay" pop-up for a loan funded under 48 hours ago (George, 2026-11-24): paying it back
// this soon doesn't raise the limit and earns no food reward. Since 2026-11-27 both start on the loan's
// halfway day (the second-half rule, countsFromAt); older loans keep the 48-hour limit rule. It only shows when waiting actually gains them something, and never when a due date is
// close: it must not talk anyone into paying late.

/** Closing it hides it for this long; it comes back once if the loan is still inside the 48 hours. */
export const FAST_REPAY_NOTICE_SNOOZE_MS = 24 * 3_600_000;
/** An open loan due this soon (or overdue) means: no "wait" advice at all. */
const DUE_SOON_DAYS = 2;

export interface FastRepayNotice {
   loanId: string;
   fundedAt: string | null;
   /** When paying starts to count for a level-up: the halfway day (older loans: 48h after funding). */
   countsFrom: Date;
   zone: string;
   /** Their limit now → after repaying this loan from `countsFrom`. Null when this loan can't level them up. */
   levelUp: { from: number; to: number } | null;
   /** "Pay Dec 1 – Dec 16 → ₱50 food" (or the streak it grows); null when no reward is waiting on the dates. */
   rewardLine: string | null;
   /** The same, in parts for the card's rows: the dates that count and what they earn. */
   reward: { from: string; to: string; label: string } | null;
}

const isOpen = (loan: Loan) =>
   !loan.refundedAt && toNumber(loan.totalRepaymentAmount) > 0 && toNumber(loan.repaidAmount) < toNumber(loan.totalRepaymentAmount);

export const getFastRepayNotice = ({
   loans,
   now = Date.now(),
   currentLimit,
   isVerified,
   joinedAt,
   streak,
   locale,
   ceiling = null
}: {
   /** The borrower's active (funded, unpaid) loans. */
   loans: Loan[];
   /** Their income ceiling (useLimitCeiling): the level-up never shows past it. */
   ceiling?: number | null;
   now?: number;
   currentLimit: number | null | undefined;
   isVerified: boolean;
   joinedAt?: string | null;
   streak: RepayStreak | null;
   locale: string;
}): FastRepayNotice | null => {
   const open = loans.filter(isOpen);
   // Something due soon or overdue: paying is the right move, whatever the 48-hour rule says.
   if (open.some((loan) => getDaysUntilDueDay(currentDueDate(loan), getLoanTimezone(loan), now) <= DUE_SOON_DAYS)) return null;

   const fresh = open
      // Shown in the loan's first 48 hours only (the snooze brings it back once), not every day until halfway.
      .filter((loan) => Boolean(loan.fundedAt) && now < Date.parse(loan.fundedAt as string) + 48 * 3_600_000)
      .map((loan) => ({ loan, countsFrom: countsFromAt(loan.fundedAt, loan.dueDate, loan.dueTimezone) }))
      .filter((entry): entry is { loan: Loan; countsFrom: Date } => Boolean(entry.countsFrom) && now < (entry.countsFrom as Date).getTime())
      .sort((a, b) => b.countsFrom.getTime() - a.countsFrom.getTime());
   const newest = fresh[0];
   if (!newest) return null;

   const { loan, countsFrom } = newest;
   const zone = getLoanTimezone(loan);
   const deadline = getDueDayEnd(currentDueDate(loan), zone);
   // A loan due before the 48 hours are up: never tell them to wait past it.
   if (countsFrom.getTime() >= deadline.getTime()) return null;

   const progression = evaluateCreditProgression({
      currentLimit,
      isVerified,
      repaidAmount: loan.totalRepaymentAmount,
      totalRepaymentAmount: loan.totalRepaymentAmount,
      loanAmount: loan.loanAmount,
      dueDate: loan.dueDate,
      dueTimezone: loan.dueTimezone,
      paidAt: countsFrom.toISOString(),
      fundedAt: loan.fundedAt ?? null,
      joinedAt: joinedAt ?? null
   });
   const limitNow = getEffectiveCreditLimit(currentLimit, isVerified);
   const nextLimit = ceiling ? getIncomeNextLimit(limitNow, ceiling, joinedAt ?? null, loan.fundedAt ?? null) : progression.nextLimit;
   const levelUp = progression.shouldLevelUp && nextLimit > limitNow ? { from: limitNow, to: nextLimit } : null;

   const rewardFrom = loan.fundedAt ? getRewardFromAt(loan.fundedAt, loan.dueDate, zone) : null;
   const window = getRewardWindow({ rewardFrom: rewardFrom?.toISOString() ?? null, deadline: deadline.toISOString(), zone }, now);
   // Only when there's a window to wait for: otherwise paying now already earns what it can.
   const rewardLine =
      window && streak ? getRepayRewardLine(streak, getDaysUntilDueDay(currentDueDate(loan), zone, now), locale, window) : null;

   if (!levelUp && !rewardLine) return null;
   const reward = rewardLine && window && streak ? { ...window, label: getRepayRewardLabel(streak) } : null;
   return { loanId: loan.id, fundedAt: loan.fundedAt ?? null, countsFrom, zone, levelUp, rewardLine, reward };
};

/** Never seen, or closed over 24 hours ago (and the caller still has a notice). */
export const isFastRepayNoticeDue = (lastSeenAt: number | null, now: number = Date.now()): boolean =>
   lastSeenAt === null || now - lastSeenAt >= FAST_REPAY_NOTICE_SNOOZE_MS;
