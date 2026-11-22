import { type PointerEvent, useEffect, useRef, useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { DASHBOARD_V2_ASSETS } from '@/views/dashboard-v2/assets';
import DesignImage from '@/views/dashboard-v2/components/DesignImage';
import type { DashboardV2Language } from '@/views/dashboard-v2/types';

// Monthly "rates are going down" announcement (George, 2026-11-22). One message: your loan is already
// cheaper than others, and if everyone repays on time it goes down again. Shown as three falling bars:
// others (the month's average across all loans incl. OTC outside the app, set by George in
// telegram_bot_settings.rates_card) → you now → everyone, if we all repay. Same look as the dashboard's
// Figma popups (floating italic title, lavender card, gradient button, round ✕ below). Once a month per
// device; close with ✕, "Got it", tapping outside, Escape, or swiping the card down. Preview: ?rates=1.

type RatesAnnouncementData = {
   enabled: boolean;
   month?: string;
   average_pct?: number | null;
   next_pct?: number | null;
   my_rate_pct?: number | null;
};

const SAMPLE: RatesAnnouncementData = { enabled: true, month: '2026-11', average_pct: 13, next_pct: 8, my_rate_pct: 10 };

const PRIMARY_GRADIENT = 'linear-gradient(77.66deg, #9584ff 0.5%, #6b55f7 98.16%)';

const COPY = {
   en: {
      title: 'Rates are going down!',
      headline: 'Your loan is cheaper',
      sub: 'All repay on time → even cheaper',
      others: 'Others',
      now: 'Now',
      you: 'You now',
      allRepay: 'We all repay',
      button: 'Got it'
   },
   fil: {
      title: 'Bumababa ang interest!',
      headline: 'Mas mura ang loan mo',
      sub: 'Lahat magbayad sa oras → mas mura pa',
      others: 'Iba',
      now: 'Ngayon',
      you: 'Ikaw ngayon',
      allRepay: 'Lahat magbayad',
      button: 'Sige'
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

type Bar = { label: string; pct: number; tone: 'grey' | 'purple' | 'gold' };

/** The falling bars. "You now" only when their rate is below the average; nothing without a lower next rate. */
const getBars = (data: RatesAnnouncementData | undefined, copy: (typeof COPY)['en']): Bar[] | null => {
   if (!data?.enabled || !data.month || data.average_pct == null || data.next_pct == null) return null;
   const average = Number(data.average_pct);
   const next = Number(data.next_pct);
   const mine = data.my_rate_pct == null ? null : Number(data.my_rate_pct);
   if (next >= average) return null;
   if (mine != null && mine < average && mine > next) {
      return [
         { label: copy.others, pct: average, tone: 'grey' },
         { label: copy.you, pct: mine, tone: 'purple' },
         { label: copy.allRepay, pct: next, tone: 'gold' }
      ];
   }
   return [
      { label: copy.now, pct: average, tone: 'purple' },
      { label: copy.allRepay, pct: next, tone: 'gold' }
   ];
};

const BAR_STYLE: Record<Bar['tone'], { bar: string; text: string }> = {
   grey: { bar: 'linear-gradient(180deg, #e3dfea 0%, #cfc9da 100%)', text: 'text-[#8f86a0]' },
   purple: { bar: PRIMARY_GRADIENT, text: 'text-[#5d4ccc] dark:text-[#b3a6ff]' },
   gold: { bar: 'linear-gradient(180deg, #ffe27a 0%, #ffbe1a 100%)', text: 'text-[#b07800] dark:text-[#ffe27a]' }
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
   const copy = COPY[language];
   const source = preview ? SAMPLE : data;
   const bars = getBars(source, copy);
   const month = source?.month ?? '';
   const [dismissed, setDismissed] = useState(false);
   const [dragY, setDragY] = useState(0);
   const dragStart = useRef<number | null>(null);

   const isOpen = Boolean(bars) && !dismissed && !blocked && (preview || !readSeen(seenKey(userId, month)));

   const close = () => {
      setDismissed(true);
      if (preview) return;
      try {
         window.localStorage.setItem(seenKey(userId, month), '1');
      } catch {
         // Storage blocked: it shows again next visit.
      }
   };

   useEffect(() => {
      if (!isOpen) return;
      const onKeyDown = (event: KeyboardEvent) => {
         if (event.key === 'Escape') setDismissed(true);
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
   }, [isOpen]);

   if (!isOpen || !bars) return null;

   const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement).closest('button')) return;
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

   const top = Math.max(...bars.map((bar) => bar.pct));

   return (
      <div
         className="fixed inset-0 z-[80] flex overflow-y-auto overscroll-contain bg-black/80 px-5 py-6"
         style={{ opacity: Math.max(0.3, 1 - dragY / 400) }}
         role="dialog"
         aria-modal="true"
         aria-labelledby="rates-card-title"
         onClick={close}
      >
         <div
            className="m-auto flex w-full max-w-[400px] touch-none select-none flex-col items-center"
            style={{ transform: `translateY(${dragY}px)`, transition: dragStart.current == null ? 'transform 200ms ease' : 'none' }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
         >
            <p
               id="rates-card-title"
               className="mb-2 max-w-[350px] text-center text-[26px] font-black italic leading-7 text-[#4c239f] underline decoration-[#7e6afa] decoration-4 underline-offset-8 dark:text-[#c4b8ff]"
            >
               {copy.title}
            </p>
            <div className="w-full overflow-hidden rounded-[26px] bg-gradient-to-b from-[#f3ecff] via-white via-40% to-white shadow-[0_-1px_0_0_#fff] dark:from-dv2-tab dark:via-dv2-card dark:to-dv2-card">
               <img src="/rates/rates-going-down.webp" alt="" className="aspect-[16/9] w-full object-cover" draggable={false} />

               <div className="flex flex-col items-center gap-4 px-5 pb-6 pt-4 text-center">
                  <div className="text-[#594d65] dark:text-[#d9cfe6]">
                     <p className="text-[24px] font-bold leading-7">{copy.headline}</p>
                     <p className="mt-1 text-[16px] leading-5">{copy.sub}</p>
                  </div>

                  <ol className="flex w-full items-end justify-center gap-4" aria-label={copy.title}>
                     {bars.map((bar) => (
                        <li key={bar.label} className="flex w-[84px] flex-col items-center gap-1.5">
                           <span className={`text-[26px] font-black leading-7 ${BAR_STYLE[bar.tone].text}`}>{fmt(bar.pct)}</span>
                           <span
                              className="w-full rounded-t-[12px]"
                              style={{ height: Math.round((bar.pct / top) ** 2 * 110), backgroundImage: BAR_STYLE[bar.tone].bar }}
                              aria-hidden="true"
                           />
                           <span className="text-[13px] font-semibold leading-4 text-[#594d65] dark:text-[#d9cfe6]">{bar.label}</span>
                        </li>
                     ))}
                  </ol>

                  <button
                     type="button"
                     onClick={close}
                     className="flex h-[52px] w-full max-w-[346px] items-center justify-center rounded-[35px] px-5 text-[20px] font-semibold tracking-[-0.4px] text-white transition active:scale-[0.99]"
                     style={{ backgroundImage: PRIMARY_GRADIENT }}
                  >
                     {copy.button}
                  </button>
               </div>
            </div>
            <button type="button" onClick={close} className="mt-14 h-[50px] w-[50px]" aria-label="Close">
               <DesignImage src={DASHBOARD_V2_ASSETS.closeLarge} className="h-[50px] w-[50px]" />
            </button>
         </div>
      </div>
   );
}
