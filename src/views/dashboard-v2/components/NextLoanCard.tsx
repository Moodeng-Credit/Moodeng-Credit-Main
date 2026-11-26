import { useMemo } from 'react';

import clsx from 'clsx';

import { useLocalization } from '@/i18n';
import { SECOND_HALF_RULE_FROM } from '@/lib/creditLeveling';
import type { RepayStreak } from '@/lib/friendReferrals';
import { isLikelyPhilippines } from '@/lib/isLikelyPhilippines';
import { useUsdcRate } from '@/lib/useUsdcRate';
import { getStreakCardCopy, hasStreakToShow } from '@/views/dashboard-v2/dashboardV2Model';
import type { DashboardV2Due } from '@/views/dashboard-v2/types';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type PayWindowStatus = 'early' | 'best' | 'late';

/**
 * One rule for borrowers (research 2026-11-26: 30% repaid within 48h hoping to level up; four different
 * "too early" rules confused them): pay in the SECOND HALF of your loan — from its halfway day (never
 * sooner than 48h after funding) to the due day. The server grows the limit on exactly that window for
 * loans funded since SECOND_HALF_RULE_FROM, and food rewards use it too. Half a 30-day loan always holds a
 * 15th or 30th payday; a last-7-days window missed both for almost half of due dates.
 */
export const getPayWindow = (
   due: Pick<DashboardV2Due, 'deadline' | 'fundedAt' | 'rewardFrom'>,
   now: number = Date.now()
): { start: number; deadline: number; funded: number; status: PayWindowStatus } | null => {
   const deadline = new Date(due.deadline).getTime();
   if (!Number.isFinite(deadline)) return null;
   const fundedRaw = due.fundedAt ? new Date(due.fundedAt).getTime() : Number.NaN;
   const rewardFrom = due.rewardFrom ? new Date(due.rewardFrom).getTime() : Number.NaN;
   const funded = Number.isFinite(fundedRaw) ? fundedRaw : deadline - 30 * DAY;
   const start = Math.min(deadline - HOUR, Math.max(funded + 48 * HOUR, Number.isFinite(rewardFrom) ? rewardFrom : 0));
   const status: PayWindowStatus = now >= deadline ? 'late' : now >= start ? 'best' : 'early';
   return { start, deadline, funded, status };
};

const dayLabel = (at: number, zone?: string) => {
   try {
      return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: zone });
   } catch {
      return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
   }
};

const COPY = {
   en: {
      eyebrow: 'Your next loan',
      upFrom: (from: number) => `↑ from $${from}`,
      stays: 'Stays the same',
      payBetween: 'Pay between',
      amount: 'Amount',
      early: 'Too early',
      best: 'Best days',
      late: 'Late',
      today: 'Today',
      nowEarly: (from: string, limit: number) => `You can pay anytime. Paying before ${from} keeps your limit at $${limit}.`,
      nowEarlyPlain: (from: string) => `You can pay anytime. Your best days start ${from}.`,
      nowBest: 'Pay now: these are your best days.',
      nowLate: 'Your loan is late. Pay as soon as you can.',
      notFull: (limit: number, next: number) => `Borrow your full $${limit} next time to reach $${next}.`,
      steps: (limit: number) => [`Borrow your full $${limit}`, 'Pay in the 2nd half of your loan', 'Your limit goes up'],
      top: 'You are at the top limit. Keep paying on time.',
      ceiling: (limit: number) =>
         `We set your limit so payments fit what you earn. $${limit} is the most we can lend on what you've shown us.`,
      ceilingLink: 'Show your income to go higher'
   },
   fil: {
      eyebrow: 'Susunod mong loan',
      upFrom: (from: number) => `↑ mula $${from}`,
      stays: 'Pareho pa rin',
      payBetween: 'Magbayad sa',
      amount: 'Halaga',
      early: 'Masyadong maaga',
      best: 'Pinakamagandang araw',
      late: 'Late',
      today: 'Ngayon',
      nowEarly: (from: string, limit: number) =>
         `Puwede kang magbayad anumang oras. Kapag nagbayad bago ${from}, mananatili sa $${limit} ang limit mo.`,
      nowEarlyPlain: (from: string) => `Puwede kang magbayad anumang oras. Simula ${from} ang pinakamagandang araw mo.`,
      nowBest: 'Magbayad na: ito ang pinakamagandang araw mo.',
      nowLate: 'Late na ang loan mo. Magbayad agad.',
      notFull: (limit: number, next: number) => `Hiramin ang buong $${limit} sa susunod para umabot ng $${next}.`,
      steps: (limit: number) => [`Hiramin ang buong $${limit}`, 'Magbayad sa 2nd half ng loan mo', 'Tataas ang limit mo'],
      top: 'Nasa pinakamataas na limit ka na. Ituloy ang on-time na bayad.',
      ceiling: (limit: number) =>
         `Itinakda namin ang limit mo para kaya ng kita mo ang bayad. $${limit} ang pinakamalaking maipapahiram namin batay sa naipakita mo.`,
      ceilingLink: 'Ipakita ang kita mo para tumaas pa'
   }
};

/**
 * Home: "Your next loan" (2026-11-26). Tala-style: the next limit up front, the real pay window as a date
 * strip (too early → best days → late), and what to pay in pesos. Replaces separate rule texts.
 */
export default function NextLoanCard({
   dues,
   limit,
   nextLimit,
   atCeiling = false,
   streak,
   now
}: {
   dues: DashboardV2Due[];
   limit: number;
   nextLimit: number;
   /** At their income ceiling: say why the limit stays, and invite proof of income. */
   atCeiling?: boolean;
   streak?: RepayStreak;
   /** Preview only: a fixed "today". */
   now?: number;
}) {
   const { locale } = useLocalization();
   const t = COPY[locale === 'fil' ? 'fil' : 'en'];
   const phpRate = useUsdcRate('php');
   const inPhilippines = useMemo(() => isLikelyPhilippines(), []);
   const today = now ?? Date.now();

   const due = [...dues].filter((item) => !item.isOverdue).sort((a, b) => a.daysRemaining - b.daysRemaining)[0] ?? dues[0];
   if (limit <= 0) return null;

   const pesos = (usd: number) => `₱${Math.round(usd * phpRate.value).toLocaleString()}`;
   const money = (usd: number) => (inPhilippines ? `≈ ${pesos(usd)}` : `$${usd.toFixed(2)}`);
   const payWindow = due ? getPayWindow(due, today) : null;
   const isFullLimit = due ? (due.principal ?? 0) >= limit - 0.01 : true;
   const canGrow = nextLimit > limit;
   const showNext = canGrow && isFullLimit;
   const bigLimit = showNext ? nextLimit : limit;
   const streakCopy = streak && hasStreakToShow(streak) ? getStreakCardCopy(streak, locale) : null;

   // Strip proportions: funded → window start (too early), window (best), a short late tail.
   let earlyPct = 70;
   let todayPct: number | null = null;
   if (payWindow) {
      const span = Math.max(payWindow.deadline - payWindow.funded, HOUR);
      earlyPct = Math.min(88, Math.max(8, ((payWindow.start - payWindow.funded) / span) * 92));
      todayPct = Math.min(100, Math.max(0, ((today - payWindow.funded) / span) * 92));
   }

   return (
      <div className="mt-3 flex flex-col gap-4 rounded-[18px] bg-[#FAF7FF] px-4 py-4 dark:bg-dv2-page" data-testid="next-loan-card">
         <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
               <p className="text-[13px] font-medium tracking-[-0.01em] text-[#70617F] dark:text-[#A89BB8]">{t.eyebrow}</p>
               <p className="mt-0.5 flex items-baseline gap-2">
                  <span className="text-[34px] font-bold leading-none tracking-[-0.04em] text-[#040033] tabular-nums dark:text-[#F0EAFF]">
                     ${bigLimit}
                  </span>
                  {inPhilippines ? (
                     <span className="text-[14px] font-medium text-[#70617F] dark:text-[#A89BB8]">≈ {pesos(bigLimit)}</span>
                  ) : null}
               </p>
               <span
                  className={clsx(
                     'mt-2 inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold leading-none',
                     showNext
                        ? 'bg-[#EAF7EC] text-[#2F7A3B] dark:bg-[#16301C] dark:text-[#8FDB9C]'
                        : 'bg-[#F3EEFB] text-[#70617F] dark:bg-[#2A2138] dark:text-[#A89BB8]'
                  )}
               >
                  {showNext ? t.upFrom(limit) : t.stays}
               </span>
            </div>
            <img src="/icons/hippo-repaid-coin-3d.png" alt="" aria-hidden="true" className="h-[72px] w-[72px] shrink-0 object-contain" />
         </div>

         {due && payWindow ? (
            <>
               {/* The pay window as one picture: grey too early, green best days, red late. */}
               <div aria-hidden="true">
                  <div className="relative h-5">
                     {todayPct !== null ? (
                        <span
                           className="absolute -translate-x-1/2 rounded-full bg-[#040033] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white dark:bg-[#F0EAFF] dark:text-[#16112a]"
                           style={{ left: `${Math.min(94, Math.max(6, todayPct))}%` }}
                        >
                           {t.today}
                        </span>
                     ) : null}
                  </div>
                  <div className="relative mt-1 flex h-2.5 overflow-hidden rounded-full">
                     <span className="h-full bg-[#E7E0F0] dark:bg-[#3A2F55]" style={{ width: `${earlyPct}%` }} />
                     <span className="h-full bg-[#3FB561]" style={{ width: `${92 - earlyPct}%` }} />
                     <span className="h-full flex-1 bg-[#F06A6A]" />
                     {todayPct !== null ? (
                        <span
                           className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#FAF7FF] bg-[#040033] shadow dark:border-dv2-page dark:bg-[#F0EAFF]"
                           style={{ left: `${todayPct}%` }}
                        />
                     ) : null}
                  </div>
                  {/* Two labels only, never wrapping: the red tail reads as late by itself. */}
                  <div className="mt-1.5 flex justify-between whitespace-nowrap text-[11px] font-semibold leading-4">
                     <span className="text-[#A89BB8]">{t.early}</span>
                     <span className="text-[#2F7A3B] dark:text-[#8FDB9C]" style={{ marginRight: '8%' }}>
                        {t.best} ↑
                     </span>
                  </div>
               </div>

               <div className="flex items-center justify-between rounded-[14px] bg-white px-3.5 py-3 shadow-[0_1px_3px_rgba(76,45,140,0.08)] dark:bg-[#221A30] dark:shadow-none">
                  <div>
                     <p className="text-[12px] font-medium text-[#70617F] dark:text-[#A89BB8]">{t.payBetween}</p>
                     <p className="text-[16px] font-semibold tracking-[-0.02em] text-[#040033] dark:text-[#F0EAFF]">
                        {dayLabel(payWindow.start, due.zone)} – {dayLabel(payWindow.deadline - 60_000, due.zone)}
                     </p>
                  </div>
                  <div className="text-right">
                     <p className="text-[12px] font-medium text-[#70617F] dark:text-[#A89BB8]">{t.amount}</p>
                     <p className="text-[16px] font-bold tracking-[-0.02em] text-[#B07A00] tabular-nums dark:text-[#F5C451]">
                        {money(due.amount)}
                     </p>
                  </div>
               </div>

               <p
                  className={clsx(
                     'text-[14px] font-medium leading-5',
                     payWindow.status === 'best'
                        ? 'text-[#2F7A3B] dark:text-[#8FDB9C]'
                        : payWindow.status === 'late'
                          ? 'text-[#D14B4B]'
                          : 'text-[#40344F] dark:text-[#D9CFEA]'
                  )}
               >
                  {payWindow.status === 'best'
                     ? t.nowBest
                     : payWindow.status === 'late'
                       ? t.nowLate
                       : isFullLimit && canGrow && payWindow.funded >= SECOND_HALF_RULE_FROM
                         ? t.nowEarly(dayLabel(payWindow.start, due.zone), limit)
                         : t.nowEarlyPlain(dayLabel(payWindow.start, due.zone))}
               </p>
               {!isFullLimit && canGrow ? (
                  <p className="text-[13px] leading-[18px] text-[#70617F] dark:text-[#A89BB8]">{t.notFull(limit, nextLimit)}</p>
               ) : null}
            </>
         ) : canGrow ? (
            // No loan out: the whole rule in three steps, before they borrow.
            <ol className="flex flex-col gap-2">
               {t.steps(limit).map((step, index) => (
                  <li key={step} className="flex items-center gap-3 text-[14px] font-medium text-[#040033] dark:text-[#F0EAFF]">
                     <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F3EEFB] text-[12px] font-bold text-[#6010D2] dark:bg-[#2A2138] dark:text-[#C4B8FF]">
                        {index + 1}
                     </span>
                     {index === 2 ? `${step}: $${nextLimit}` : step}
                  </li>
               ))}
            </ol>
         ) : atCeiling ? null : (
            <p className="text-[14px] text-[#70617F] dark:text-[#A89BB8]">{t.top}</p>
         )}

         {atCeiling ? (
            // Income ceiling (2026-11-27): fair wording, never a label like "low income"; proof is optional.
            <div className="flex flex-col gap-2 rounded-[14px] bg-white px-3.5 py-3 shadow-[0_1px_3px_rgba(76,45,140,0.08)] dark:bg-[#221A30] dark:shadow-none">
               <p className="text-[14px] leading-[20px] text-[#40344F] dark:text-[#D9CFEA]">{t.ceiling(limit)}</p>
               <a href="/documents" className="text-[14px] font-semibold text-[#6010D2] dark:text-[#C4B8FF]">
                  {t.ceilingLink} ›
               </a>
            </div>
         ) : null}

         {streakCopy ? (
            <p className="flex items-center gap-2 border-t border-[#F1ECF7] pt-3 text-[13px] font-medium text-[#40344F] dark:border-[#2E2540] dark:text-[#D9CFEA]">
               <span aria-hidden="true">🍗</span>
               {streakCopy.caption}
            </p>
         ) : null}
      </div>
   );
}
