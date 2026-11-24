import { toNumber } from '@/utils/decimalHelpers';

import { countsFromAt, evaluateCreditProgression, getEffectiveCreditLimit } from '@/lib/creditLeveling';
import type { RepayStreak } from '@/lib/friendReferrals';
import { getDaysUntilDueDay, getDueDayEnd, getLoanTimezone, getRewardFromAt } from '@/lib/loanDeadline';
import { currentDueDate } from '@/lib/repaymentSchedule';
import type { Loan } from '@/types/loanTypes';
import { getRepayRewardLine, getRewardWindow } from '@/views/dashboard-v2/dashboardV2Model';

// "Before you repay" pop-up for a loan funded under 48 hours ago (George, 2026-11-24): paying it back
// this soon doesn't raise the limit (the 48-hour rule) and, before the loan's halfway day, earns no
// food reward. It only shows when waiting actually gains them something, and never when a due date is
// close: it must not talk anyone into paying late.

/** Closing it hides it for this long; it comes back once if the loan is still inside the 48 hours. */
export const FAST_REPAY_NOTICE_SNOOZE_MS = 24 * 3_600_000;
/** An open loan due this soon (or overdue) means: no "wait" advice at all. */
const DUE_SOON_DAYS = 2;

export interface FastRepayNotice {
   loanId: string;
   /** 48 hours after funding: paying from then on counts for a level-up. */
   countsFrom: Date;
   zone: string;
   /** Their limit now → after repaying this loan from `countsFrom`. Null when this loan can't level them up. */
   levelUp: { from: number; to: number } | null;
   /** "Pay Dec 1 – Dec 16 → ₱50 food" (or the streak it grows); null when no reward is waiting on the dates. */
   rewardLine: string | null;
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
   locale
}: {
   /** The borrower's active (funded, unpaid) loans. */
   loans: Loan[];
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
      .map((loan) => ({ loan, countsFrom: countsFromAt(loan.fundedAt) }))
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
   const levelUp = progression.shouldLevelUp && progression.nextLimit > limitNow ? { from: limitNow, to: progression.nextLimit } : null;

   const rewardFrom = loan.fundedAt ? getRewardFromAt(loan.fundedAt, loan.dueDate, zone) : null;
   const window = getRewardWindow({ rewardFrom: rewardFrom?.toISOString() ?? null, deadline: deadline.toISOString(), zone }, now);
   // Only when there's a window to wait for: otherwise paying now already earns what it can.
   const rewardLine =
      window && streak ? getRepayRewardLine(streak, getDaysUntilDueDay(currentDueDate(loan), zone, now), locale, window) : null;

   if (!levelUp && !rewardLine) return null;
   return { loanId: loan.id, countsFrom, zone, levelUp, rewardLine };
};

/** Never seen, or closed over 24 hours ago (and the caller still has a notice). */
export const isFastRepayNoticeDue = (lastSeenAt: number | null, now: number = Date.now()): boolean =>
   lastSeenAt === null || now - lastSeenAt >= FAST_REPAY_NOTICE_SNOOZE_MS;
