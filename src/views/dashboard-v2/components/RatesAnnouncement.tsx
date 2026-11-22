import { type PointerEvent, useRef, useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { DashboardV2Language } from '@/views/dashboard-v2/types';

// Monthly "rates go down when we all repay" announcement (George, 2026-11-22; Figma "Rates going down –
// announcement card"). Shows the month's average rate (all loans, incl. OTC outside the app, set by
// George in telegram_bot_settings.rates_card), the borrower's own rate, how many loans due this month were
// paid on time, and the rate everyone gets next if the goal is reached. Pops up once per month per device;
// close with ✕, "Got it", tapping outside, or swiping the card down. Preview: ?rates=1 on any host.

type RatesAnnouncementData = {
   enabled: boolean;
   month?: string;
   average_pct?: number | null;
   goal_pct?: number | null;
   next_pct?: number | null;
   on_time_pct?: number | null;
   my_rate_pct?: number | null;
};

const SAMPLE: RatesAnnouncementData = {
   enabled: true,
   month: '2026-11',
   average_pct: 12,
   goal_pct: 90,
   next_pct: 8,
   on_time_pct: 84,
   my_rate_pct: 10
};

const MONTHS: Record<DashboardV2Language, string[]> = {
   en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
   fil: ['Enero', 'Pebrero', 'Marso', 'Abril', 'Mayo', 'Hunyo', 'Hulyo', 'Agosto', 'Setyembre', 'Oktubre', 'Nobyembre', 'Disyembre']
};

const COPY = {
   en: {
      update: 'update',
      title: 'Repay on time,\nrates go down for all',
      average: 'Average',
      yours: 'Your rate',
      onTime: (pct: number) => `${pct}% paid on time`,
      goal: (pct: number) => `Goal ${pct}%`,
      reach: (pct: number) => `Reach ${pct}% →`,
      next: (pct: number) => `next loan ${pct}% for everyone`,
      button: 'Got it',
      swipe: 'Swipe down to close',
      close: 'Close'
   },
   fil: {
      update: 'update',
      title: 'Magbayad sa oras,\nbababa ang interest ng lahat',
      average: 'Average',
      yours: 'Rate mo',
      onTime: (pct: number) => `${pct}% nagbayad sa oras`,
      goal: (pct: number) => `Goal ${pct}%`,
      reach: (pct: number) => `Umabot sa ${pct}% →`,
      next: (pct: number) => `${pct}% sa susunod na loan ng lahat`,
      button: 'Sige',
      swipe: 'I-swipe pababa para isara',
      close: 'Isara'
   }
} satisfies Record<DashboardV2Language, unknown>;

const seenKey = (userId: string, month: string) => `rates-card:${userId}:${month}`;

const readSeen = (key: string) => {
   try {
      return window.localStorage.getItem(key) === '1';
   } catch {
      return false;
   }
};

const fmt = (pct: number) => `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;

const fetchRates = async (): Promise<RatesAnnouncementData> => {
   const { data, error } = await getSupabaseBrowserClient().rpc('rates_announcement');
   if (error || !data) return { enabled: false };
   return data as RatesAnnouncementData;
};

/** Who sees it, and what: nothing without the month's numbers; "your rate" only when it is below the average. */
const getRatesView = (data: RatesAnnouncementData | undefined) => {
   if (!data?.enabled || !data.month || data.average_pct == null) return null;
   const average = Number(data.average_pct);
   const mine = data.my_rate_pct == null ? null : Number(data.my_rate_pct);
   return {
      month: data.month,
      average,
      mine: mine != null && mine < average ? mine : null,
      goal: Number(data.goal_pct ?? 90),
      next: data.next_pct == null ? null : Number(data.next_pct),
      onTime: data.on_time_pct == null ? null : Math.round(Number(data.on_time_pct))
   };
};

export default function RatesAnnouncement({
   language,
   userId,
   preview,
   blocked
}: {
   language: DashboardV2Language;
   userId: string;
   /** Sample numbers, always shown (team preview). */
   preview?: boolean;
   /** Another popup is open: wait for it. */
   blocked?: boolean;
}) {
   const { data } = useQuery({
      queryKey: ['rates-announcement', userId],
      queryFn: fetchRates,
      enabled: !preview && Boolean(userId),
      staleTime: 5 * 60_000
   });
   const view = getRatesView(preview ? SAMPLE : data);
   const [dismissed, setDismissed] = useState(false);
   const [dragY, setDragY] = useState(0);
   const dragStart = useRef<number | null>(null);

   if (!view || dismissed || blocked) return null;
   if (!preview && readSeen(seenKey(userId, view.month))) return null;

   const copy = COPY[language];
   const monthName = MONTHS[language][Number(view.month.slice(5, 7)) - 1] ?? '';
   const close = () => {
      setDismissed(true);
      if (preview) return;
      try {
         window.localStorage.setItem(seenKey(userId, view.month), '1');
      } catch {
         // Storage blocked: it shows again next visit.
      }
   };

   const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
      dragStart.current = event.clientY;
      event.currentTarget.setPointerCapture(event.pointerId);
   };
   const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
      if (dragStart.current == null) return;
      setDragY(Math.max(0, event.clientY - dragStart.current));
   };
   const onPointerEnd = () => {
      if (dragStart.current == null) return;
      dragStart.current = null;
      if (dragY > 90) close();
      else setDragY(0);
   };

   const progress = view.onTime == null ? 0 : Math.min(100, view.onTime);

   return (
      <div
         className="fixed inset-0 z-[70] flex items-center justify-center bg-[#140b33]/55 px-5"
         style={{ opacity: Math.max(0.3, 1 - dragY / 400) }}
         onClick={close}
         role="presentation"
      >
         <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rates-card-title"
            className="w-full max-w-[350px] touch-none select-none overflow-hidden rounded-[28px] bg-white shadow-[0_12px_32px_rgba(42,30,92,0.25)] dark:bg-dv2-card"
            style={{ transform: `translateY(${dragY}px)`, transition: dragStart.current == null ? 'transform 200ms ease' : 'none' }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
         >
            <div className="relative aspect-[350/197] w-full bg-[#e4dafb]">
               <img src="/rates/rates-going-down.webp" alt="" className="h-full w-full object-cover" draggable={false} />
               <span className="absolute left-1/2 top-2.5 h-[5px] w-10 -translate-x-1/2 rounded-full bg-white/90" aria-hidden="true" />
               <button
                  type="button"
                  aria-label={copy.close}
                  onClick={close}
                  onPointerDown={(event) => event.stopPropagation()}
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[14px] font-bold text-[#2a1e5c]"
               >
                  ✕
               </button>
            </div>

            <div className="flex flex-col gap-3.5 px-5 pb-5 pt-[18px]">
               <span className="self-start rounded-full bg-[#efe8ff] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#6b4fd8] dark:bg-[#2c2357] dark:text-[#c4b8ff]">
                  {monthName} {copy.update}
               </span>
               <p id="rates-card-title" className="whitespace-pre-line text-[22px] font-extrabold leading-7 text-[#2a1e5c] dark:text-white">
                  {copy.title}
               </p>

               <div className="flex gap-2.5">
                  <div className="flex flex-1 flex-col gap-0.5 rounded-2xl bg-[#f4f1fb] p-3 dark:bg-[#231c45]">
                     <span className="text-[12px] font-semibold text-[#7a6fa3] dark:text-[#b3a9d9]">{copy.average}</span>
                     <span className="text-[28px] font-extrabold leading-8 text-[#2a1e5c] dark:text-white">{fmt(view.average)}</span>
                  </div>
                  {view.mine != null ? (
                     <div className="flex flex-1 flex-col gap-0.5 rounded-2xl border-[1.5px] border-[#ffbe1a] bg-[#fff6d6] p-3 dark:bg-[#2a2210]">
                        <span className="text-[12px] font-semibold text-[#8a5a00] dark:text-[#ffe27a]">{copy.yours}</span>
                        <span className="text-[28px] font-extrabold leading-8 text-[#4a2a00] dark:text-[#ffe27a]">{fmt(view.mine)}</span>
                     </div>
                  ) : null}
               </div>

               {view.onTime != null ? (
                  <div className="flex flex-col gap-2">
                     <div className="flex justify-between text-[13px] font-semibold">
                        <span className="text-[#2a1e5c] dark:text-white">{copy.onTime(view.onTime)}</span>
                        <span className="text-[#7a6fa3] dark:text-[#b3a9d9]">{copy.goal(view.goal)}</span>
                     </div>
                     <div className="relative h-2.5 rounded-full bg-[#ece6fa] dark:bg-[#2c2357]">
                        <div
                           className="h-full rounded-full"
                           style={{ width: `${progress}%`, backgroundImage: 'linear-gradient(90deg, #8b6cff, #6b4fd8)' }}
                        />
                        <span
                           className="absolute -top-[3px] h-4 w-0.5 bg-[#ffbe1a]"
                           style={{ left: `${Math.min(100, view.goal)}%` }}
                           aria-hidden="true"
                        />
                     </div>
                  </div>
               ) : null}

               {view.next != null ? (
                  <div
                     className="flex items-center gap-2.5 rounded-2xl p-3 dark:!bg-[#231c45]"
                     style={{ backgroundImage: 'linear-gradient(90deg, #f3eeff, #fff6d6)' }}
                  >
                     <span className="text-[20px] font-bold text-[#ffbe1a]" aria-hidden="true">
                        ⬇
                     </span>
                     <div className="flex flex-col">
                        <span className="text-[13px] font-semibold text-[#5a4e86] dark:text-[#b3a9d9]">{copy.reach(view.goal)}</span>
                        <span className="text-[15px] font-bold text-[#2a1e5c] dark:text-white">{copy.next(view.next)}</span>
                     </div>
                  </div>
               ) : null}

               <button
                  type="button"
                  onClick={close}
                  onPointerDown={(event) => event.stopPropagation()}
                  className="h-[52px] w-full rounded-full bg-[#6b4fd8] text-[16px] font-bold text-white"
               >
                  {copy.button}
               </button>
               <p className="text-center text-[11px] text-[#9a92bd]">{copy.swipe}</p>
            </div>
         </div>
      </div>
   );
}
