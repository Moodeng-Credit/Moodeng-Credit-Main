import { useMemo, useState } from 'react';

import clsx from 'clsx';
import { CalendarPlus, Check } from 'lucide-react';

import { useRewardsAfterRepayment } from '@/hooks/useFriendReferrals';

import { formatCurrency } from '@/utils/decimalHelpers';

import { useLocalization } from '@/i18n';
import { buildCalendarLinks, prefersIcsCalendar } from '@/lib/calendarLinks';
import type { ClaimableVoucher, MyRewards, RepayStreak } from '@/lib/friendReferrals';
import { getStreakCardCopy, hasStreakToShow, STREAK_LENGTH, STREAK_VOUCHERS } from '@/views/dashboard-v2/dashboardV2Model';
import { VoucherClaimPopup } from '@/views/dashboard-v2/DashboardV2Rewards';
import type { DashboardV2Due } from '@/views/dashboard-v2/types';

// Green, not gold: the success screen already has its one gold button (Pay next loan / Borrow again).
const CLAIM_BUTTON =
   'flex h-[44px] w-full items-center justify-center rounded-full bg-[#3c8248] text-[16px] font-bold text-white shadow-[0_2px_1px_rgba(63,89,79,0.4)] active:scale-[0.98]';

/** One dot per on-time repayment, with the food voucher under the steps that pay one. */
export function StreakSteps({ streak }: { streak: RepayStreak }) {
   return (
      <ol className="flex items-start" aria-label={`${streak.current} on time in a row`}>
         {Array.from({ length: STREAK_LENGTH }, (_, index) => {
            const step = index + 1;
            const voucher = STREAK_VOUCHERS.find((item) => item.step === step);
            const isDone = step <= streak.current;
            return (
               <li key={step} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full items-center">
                     <span className={clsx('h-[3px] flex-1', index === 0 ? 'bg-transparent' : isDone ? 'bg-[#4aa256]' : 'bg-[#e6dfa3]')} />
                     <span
                        className={clsx(
                           'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-bold',
                           isDone ? 'bg-[#4aa256] text-white' : 'border-2 border-[#d9cf7a] bg-white/70 text-[#8a7d2c]'
                        )}
                     >
                        {isDone ? <Check className="h-4 w-4" aria-hidden="true" /> : step}
                     </span>
                     <span
                        className={clsx(
                           'h-[3px] flex-1',
                           step === STREAK_LENGTH ? 'bg-transparent' : step < streak.current ? 'bg-[#4aa256]' : 'bg-[#e6dfa3]'
                        )}
                     />
                  </div>
                  <span className={clsx('h-4 text-[12px] font-bold leading-4', voucher ? 'text-[#3c8248]' : 'text-transparent')}>
                     {voucher ? `₱${voucher.amountPhp}` : '·'}
                  </span>
               </li>
            );
         })}
      </ol>
   );
}

/** Dashboard: the streak and what the next on-time repayment brings, above the loans that are due. */
export function RepayStreakCard({ streak }: { streak: RepayStreak }) {
   const { locale } = useLocalization();
   if (!hasStreakToShow(streak)) return null;
   const copy = getStreakCardCopy(streak, locale);
   return (
      <div
         className="mt-3 flex flex-col gap-2 rounded-[8px] px-3 py-3"
         style={{ backgroundImage: 'linear-gradient(90deg, #fff3a3 0%, #ffe27a 100%)' }}
         data-testid="repay-streak-card"
      >
         <p className="text-[18px] font-black italic leading-6 text-[#3c8248]">{copy.title}</p>
         <StreakSteps streak={streak} />
         <p className="text-[14px] font-medium leading-[18px] text-[#6f7d1d]">{copy.caption}</p>
      </div>
   );
}

/**
 * "Add to calendar" for a loan's due day: 9:00 that morning in the borrower's own zone, with an alert
 * the day before too. Opens the phone's calendar (Google link, or an .ics on Apple devices), so it works
 * for phone-only accounts.
 */
export function AddDueToCalendar({ due, rewardLine }: { due: DashboardV2Due; rewardLine: string | null }) {
   const link = useMemo(() => {
      const deadline = new Date(due.deadline);
      if (Number.isNaN(deadline.getTime())) return null;
      // The deadline is midnight after the due day, so 15 hours earlier is 9:00 on the due day.
      const links = buildCalendarLinks({
         title: `Repay Moodeng loan · $${formatCurrency(due.amount)}`,
         details: `${rewardLine ? `${rewardLine}. ` : ''}Repay today at https://moodeng.app/repay`,
         start: new Date(deadline.getTime() - 15 * 3_600_000),
         minutes: 30,
         alertsMinutesBefore: [0, 24 * 60]
      });
      return prefersIcsCalendar() ? { href: links.ics, download: 'moodeng-loan-due.ics' } : { href: links.google, download: undefined };
   }, [due.amount, due.deadline, rewardLine]);

   if (!link) return null;
   return (
      <a
         href={link.href}
         download={link.download}
         target={link.download ? undefined : '_blank'}
         rel="noreferrer"
         className="flex h-[34px] shrink-0 items-center gap-1 rounded-full border border-[#d9d2ee] bg-white px-2.5 text-[13px] font-semibold text-[#5640e0] active:scale-[0.97] dark:border-[#3a2f55] dark:bg-dv2-page dark:text-[#c4b8ff]"
      >
         <CalendarPlus className="h-4 w-4" aria-hidden="true" />
         Add to calendar
      </a>
   );
}

// Preview / demo repayments never touch the database, so the celebration shows a sample.
const SAMPLE_AFTER_REPAY: Pick<MyRewards, 'streak' | 'claimable'> = {
   streak: { current: 1, best: 1, nextStep: 3, toGo: 2, nextPhp: 50 },
   claimable: [{ reward: 'first_on_time_repayment', friendReferralId: null, amountPhp: 50 }]
};

/**
 * Right after a repayment: the streak it built and, when it earned a food voucher, the button to claim
 * it on the spot (the reward used to arrive as a bot message the next morning).
 */
export function RepayStreakCelebration({ isPreview = false }: { isPreview?: boolean }) {
   const { locale } = useLocalization();
   const live = useRewardsAfterRepayment(!isPreview);
   // Snapshot the voucher: claiming removes it from `claimable`, and the popup must stay for its thank-you.
   const [claiming, setClaiming] = useState<ClaimableVoucher | null>(null);
   const rewards = isPreview ? SAMPLE_AFTER_REPAY : live.rewards;
   const isReady = isPreview || live.isReady;
   const voucher = rewards.claimable[0] ?? null;

   if (!isReady || (!hasStreakToShow(rewards.streak) && !voucher)) return null;
   const copy = getStreakCardCopy(rewards.streak, locale);

   return (
      <section
         className="flex w-full flex-col gap-3 rounded-[16px] px-4 py-4 text-left"
         style={{ backgroundImage: 'linear-gradient(90deg, #fff3a3 0%, #ffe27a 100%)' }}
         aria-label="Your repay streak"
      >
         <p className="text-[20px] font-black italic leading-6 text-[#3c8248]">{copy.title}</p>
         <StreakSteps streak={rewards.streak} />
         {voucher ? (
            <button type="button" onClick={() => setClaiming(voucher)} className={CLAIM_BUTTON}>
               Claim ₱{voucher.amountPhp} food
            </button>
         ) : (
            <p className="text-[14px] font-medium leading-[18px] text-[#6f7d1d]">{copy.caption}</p>
         )}
         {rewards.streak.current === 0 ? (
            <p className="text-[12px] leading-[16px] text-[#6f7d1d]">Late payments and loans repaid within a day don&apos;t count.</p>
         ) : null}
         {claiming ? <VoucherClaimPopup voucher={claiming} isPreview={isPreview} onClose={() => setClaiming(null)} /> : null}
      </section>
   );
}
