import { useQuery } from '@tanstack/react-query';

import { detectInAppBrowser } from '@/lib/inAppBrowser';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { DashboardV2Language } from '@/views/dashboard-v2/types';

// "Your limit stays at $X" (George, 2026-11-18): for borrowers whose limit didn't go up because they
// repaid within 48 hours (the 48-hour rule), or whose limit the team reset for it. Says why, and gives
// one button to talk to us on Messenger, plus a link to add proof of income.
// Who sees it: public.my_limit_notice() (migration 20261118190000).

type LimitNotice = { show: boolean; limit?: number };

const PAGE_ID = '61589106561061';

const COPY: Record<DashboardV2Language, { title: (limit: number) => string; body: string; ask: string; button: string; docs: string }> = {
   en: {
      title: (limit) => `Your limit stays at $${limit}`,
      body: 'Loans paid back within 2 days don’t raise your limit. By local lending rules we can only raise it about once a month — going faster would break the 15% monthly interest cap.',
      ask: 'Want to talk about it, or show us more about your income?',
      button: 'Message us on Messenger',
      docs: 'Add proof of income'
   },
   fil: {
      title: (limit) => `Mananatili sa $${limit} ang limit mo`,
      body: 'Hindi tumataas ang limit kapag nabayaran ang loan sa loob ng 2 araw. Ayon sa lokal na patakaran sa pagpapautang, mga isang beses lang kada buwan namin ito puwedeng itaas — kapag mas mabilis, lalampas sa 15% na buwanang limit sa interes.',
      ask: 'Gusto mo bang pag-usapan, o magpakita pa tungkol sa kita mo?',
      button: 'Mag-message sa Messenger',
      docs: 'Magdagdag ng proof of income'
   }
};

const messengerLink = () => {
   // Android Chrome can't open m.me links; messenger.com/t works everywhere.
   const isAndroid = detectInAppBrowser().os === 'android';
   return isAndroid ? `https://www.messenger.com/t/${PAGE_ID}` : `https://m.me/${PAGE_ID}?ref=limit_stays`;
};

export default function LimitStaysCard({ language, preview }: { language: DashboardV2Language; preview?: boolean }) {
   const { data } = useQuery({
      queryKey: ['my-limit-notice'],
      queryFn: async (): Promise<LimitNotice> => {
         const { data: res, error } = await getSupabaseBrowserClient().rpc('my_limit_notice');
         if (error || !res || typeof res !== 'object') return { show: false };
         return res as LimitNotice;
      },
      enabled: !preview,
      staleTime: 5 * 60_000
   });
   const notice = preview ? { show: true, limit: 15 } : data;
   if (!notice?.show) return null;
   const copy = COPY[language] ?? COPY.en;

   return (
      <section className="mx-5 flex flex-col gap-3 rounded-[8px] border border-[#f1d58a] bg-[#fff8e1] px-4 py-4 dark:border-[#5a4818] dark:bg-[#2a2210]" aria-label="Your limit">
         <p className="text-[18px] font-black leading-6 text-[#6b4a00] dark:text-[#ffe27a]">{copy.title(notice.limit ?? 15)}</p>
         <p className="text-[14px] leading-[20px] text-[#6b5a2e] dark:text-[#e8d9a8]">{copy.body}</p>
         <p className="text-[14px] font-bold leading-[20px] text-[#6b5a2e] dark:text-[#e8d9a8]">{copy.ask}</p>
         <a
            className="flex h-[42px] w-full items-center justify-center rounded-full bg-[#ffce1b] text-[15px] font-bold text-[#704518] shadow-[0_-2px_1px_rgba(255,255,255,0.3),0_2px_1px_rgba(63,89,79,0.4)]"
            href={messengerLink()}
            rel="noreferrer"
            target="_blank"
         >
            {copy.button}
         </a>
         <a className="text-center text-[14px] font-semibold text-[#7a5d10] underline dark:text-[#ffe27a]" href="/documents">
            {copy.docs}
         </a>
      </section>
   );
}
