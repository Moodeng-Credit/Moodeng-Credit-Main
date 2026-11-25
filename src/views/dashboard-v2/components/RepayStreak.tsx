import { useMemo, useState } from 'react';

import clsx from 'clsx';
import { CalendarPlus, Check } from 'lucide-react';

import { useRewardsAfterRepayment } from '@/hooks/useFriendReferrals';

import { formatCurrency } from '@/utils/decimalHelpers';

import { EXTERNAL_LINKS } from '@/config/externalLinks';
import { useLocalization } from '@/i18n';
import { buildCalendarLinks, prefersIcsCalendar } from '@/lib/calendarLinks';
import type { ClaimableVoucher, MyRewards, RepayStreak } from '@/lib/friendReferrals';
import {
   getRewardRuleCopy,
   getStreakCardCopy,
   hasStreakToShow,
   STREAK_LENGTH,
   STREAK_VOUCHERS
} from '@/views/dashboard-v2/dashboardV2Model';
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

/** The tracker's dots: small, purple when done, the ₱ voucher under the steps that pay one. */
function TrackerSteps({ streak }: { streak: RepayStreak }) {
   return (
      <ol className="flex items-start" aria-label={`${streak.current} on time in a row`}>
         {Array.from({ length: STREAK_LENGTH }, (_, index) => {
            const step = index + 1;
            const voucher = STREAK_VOUCHERS.find((item) => item.step === step);
            const isDone = step <= streak.current;
            const isNext = step === streak.current + 1;
            return (
               <li key={step} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full items-center">
                     <span
                        className={clsx(
                           'h-[2px] flex-1',
                           index === 0 ? 'bg-transparent' : isDone ? 'bg-[#6010D2]' : 'bg-[#E7E0F0] dark:bg-[#3A2F55]'
                        )}
                     />
                     <span
                        className={clsx(
                           'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold',
                           isDone
                              ? 'bg-[#6010D2] text-white'
                              : isNext
                                ? 'border-2 border-[#6010D2] bg-white text-[#6010D2] dark:bg-dv2-page dark:text-[#C4B8FF]'
                                : 'border border-[#E7E0F0] bg-white text-[#A89BB8] dark:border-[#3A2F55] dark:bg-dv2-page'
                        )}
                     >
                        {isDone ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /> : step}
                     </span>
                     <span
                        className={clsx(
                           'h-[2px] flex-1',
                           step === STREAK_LENGTH
                              ? 'bg-transparent'
                              : step < streak.current
                                ? 'bg-[#6010D2]'
                                : 'bg-[#E7E0F0] dark:bg-[#3A2F55]'
                        )}
                     />
                  </div>
                  <span
                     className={clsx(
                        'h-4 text-[11px] font-semibold leading-4',
                        voucher ? 'text-[#B07A00] dark:text-[#F5C451]' : 'text-transparent'
                     )}
                  >
                     {voucher ? `₱${voucher.amountPhp}` : '·'}
                  </span>
               </li>
            );
         })}
      </ol>
   );
}

const TRACKER_COPY = {
   en: {
      title: 'Pay on time',
      inARow: (n: number) => `🔥 ${n} in a row`,
      limit: (from: number, to: number) => `Repay your full $${from} → $${to} limit`
   },
   fil: {
      title: 'Magbayad on time',
      inARow: (n: number) => `🔥 ${n} sunod-sunod`,
      limit: (from: number, to: number) => `Bayaran ang buong $${from} → $${to} limit`
   }
};

/**
 * Dashboard "Pay on time" tracker (Abby, 2026-11-26: show what paying on time gets you, on the home
 * screen). Two real perks only — the next food voucher and the next credit limit; the price stays the
 * same for everyone, so it never promises a cheaper loan. Crisp white card like the sign-in screen.
 */
export function RepayStreakCard({ streak, limit = 0, nextLimit = 0 }: { streak: RepayStreak; limit?: number; nextLimit?: number }) {
   const { locale } = useLocalization();
   const showStreak = hasStreakToShow(streak);
   const showLimit = limit > 0 && nextLimit > limit;
   if (!showStreak && !showLimit) return null;
   const copy = getStreakCardCopy(streak, locale);
   const t = TRACKER_COPY[locale === 'fil' ? 'fil' : 'en'];
   return (
      <div
         className="mt-3 flex flex-col gap-3 rounded-[16px] border border-[#EEE8F5] bg-white px-4 py-4 dark:border-[#3A2F55] dark:bg-dv2-page"
         data-testid="repay-streak-card"
      >
         <div className="flex items-center gap-2">
            <img src="/auth-screen.png" alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
            <p className="text-[17px] font-bold leading-6 tracking-[-0.03em] text-[#040033] dark:text-[#F0EAFF]">{t.title}</p>
            {streak.current > 0 ? (
               <span className="ml-auto rounded-full bg-[#F3EEFB] px-2.5 py-1 text-[12px] font-semibold leading-none text-[#6010D2] dark:bg-[#2A2138] dark:text-[#C4B8FF]">
                  {t.inARow(streak.current)}
               </span>
            ) : null}
         </div>
         {showStreak ? <TrackerSteps streak={streak} /> : null}
         <ul className="flex flex-col gap-1.5 text-[14px] leading-[18px] tracking-[-0.01em] text-[#40344F] dark:text-[#D9CFEA]">
            {showStreak ? (
               <li className="flex items-start gap-2">
                  <span aria-hidden="true">🍗</span>
                  <span>{copy.caption}</span>
               </li>
            ) : null}
            {showLimit ? (
               <li className="flex items-start gap-2">
                  <span aria-hidden="true">⬆️</span>
                  <span>{t.limit(limit, nextLimit)}</span>
               </li>
            ) : null}
         </ul>
         {showStreak && streak.nextStep !== null ? (
            <p className="text-[12px] leading-[16px] text-[#70617F] dark:text-[#A89BB8]">{getRewardRuleCopy(locale).halfwayRule}</p>
         ) : null}
      </div>
   );
}

// Android Chrome can't open m.me links; messenger.com/t works there.
const earlyRewardHref = () =>
   typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
      ? EXTERNAL_LINKS.support.messengerLoginCodeAndroid
      : EXTERNAL_LINKS.support.messengerEarlyReward;

/** Repaid before the loan's halfway day: say plainly there's no food reward, and how to ask for it. */
function EarlyPaidCard({ locale }: { locale: string }) {
   const copy = getRewardRuleCopy(locale);
   return (
      <section
         className="flex w-full flex-col gap-3 rounded-[16px] px-4 py-4 text-left"
         style={{ backgroundImage: 'linear-gradient(90deg, #fff3a3 0%, #ffe27a 100%)' }}
         aria-label="Paid early"
         data-testid="early-paid-card"
      >
         <p className="text-[20px] font-black italic leading-6 text-[#3c8248]">{copy.earlyPaidTitle}</p>
         <p className="text-[15px] font-medium leading-[20px] text-[#5c6a14]">{copy.earlyPaidBody}</p>
         <a href={earlyRewardHref()} target="_blank" rel="noreferrer" className={CLAIM_BUTTON}>
            💬 {copy.earlyPaidButton}
         </a>
         <p className="text-[12px] leading-[16px] text-[#6f7d1d]">{copy.halfwayRule}</p>
      </section>
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

const SAMPLE_EARLY_REPAY: Pick<MyRewards, 'streak' | 'claimable'> = {
   streak: {
      current: 0,
      best: 0,
      nextStep: 1,
      toGo: 1,
      nextPhp: 50,
      earlyPaid: { rewardFrom: new Date(Date.now() + 12 * 864e5).toISOString() }
   },
   claimable: []
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
   // Preview: /repay-preview?paid=1&early=1 shows the paid-early card.
   const previewEarly = isPreview && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('early');
   const rewards = isPreview ? (previewEarly ? SAMPLE_EARLY_REPAY : SAMPLE_AFTER_REPAY) : live.rewards;
   const isReady = isPreview || live.isReady;
   const voucher = rewards.claimable[0] ?? null;

   if (!isReady) return null;
   // Paid before halfway and nothing to claim: no streak dots, just why there's no reward.
   if (rewards.streak.earlyPaid && !voucher) return <EarlyPaidCard locale={locale} />;
   if (!hasStreakToShow(rewards.streak) && !voucher) return null;
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
            <p className="text-[12px] leading-[16px] text-[#6f7d1d]">
               Late payments and payments before your loan&apos;s halfway day don&apos;t count.
            </p>
         ) : null}
         {claiming ? <VoucherClaimPopup voucher={claiming} isPreview={isPreview} onClose={() => setClaiming(null)} /> : null}
      </section>
   );
}
