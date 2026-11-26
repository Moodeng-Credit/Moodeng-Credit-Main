import { useState } from 'react';

import { CREDIT_TIERS, type CreditTrack, getCreditTrack, getNextCreditTier, MAX_CREDIT_LIMIT } from '@/config/creditTiers';
import type { DashboardV2Language } from '@/views/dashboard-v2/types';

// Credit tracks (George, 2026-11-22). Track A, borrowers who joined before October 2026, keep the old
// ladder ($20 → $40 → $60): an "early member" card says so. Track B borrowers still at an old limit
// ($20, $40 …) move to the new ladder ($20 → $25 → $35): a card shows their next limits. One "Got it"
// hides it until their limit changes. A Track B borrower whose open full-limit loan was funded before the Nov 14
// switch still gets the old step for that loan, then +$10: their card shows $20 → $40 → $45.
// Preview: ?track=A, ?track=B or ?track=B&promise=1 on a preview host.

const COPY: Record<
   DashboardV2Language,
   Record<CreditTrack, { title: string; body: string }> & { promise: (next: number) => string; button: string }
> = {
   en: {
      A: { title: 'Early member perk 🎉', body: 'You joined early, so you keep the bigger steps.' },
      B: { title: 'New levels', body: 'Each full loan you pay back adds $10.' },
      promise: (next: number) => `Pay this loan back: $${next}. After that, +$10 each time.`,
      button: 'Got it'
   },
   fil: {
      A: { title: 'Perk ng early member 🎉', body: 'Maaga kang sumali, kaya sa iyo pa rin ang mas malalaking hakbang.' },
      B: { title: 'Bagong levels', body: 'Bawat buong loan na nabayaran mo, +$10.' },
      promise: (next: number) => `Bayaran ang loan na ito: $${next}. Pagkatapos, +$10 bawat level.`,
      button: 'Sige'
   }
};

const seenKey = (userId: string, track: CreditTrack, limit: number) => `credit-track-card:${userId}:${track}:${limit}`;

const readSeen = (key: string) => {
   try {
      return window.localStorage.getItem(key) === '1';
   } catch {
      return false;
   }
};

/** Who sees it: verified, below the top; Track A always, Track B only while on an old-ladder limit. */
const shouldShowCreditTrackCard = (track: CreditTrack, limit: number) =>
   limit > 0 && limit < MAX_CREDIT_LIMIT && (track === 'A' || !CREDIT_TIERS.includes(limit));

export default function CreditTrackCard({
   language,
   userId,
   joinedAt,
   limit,
   openFundedAt,
   preview,
   previewPromise
}: {
   language: DashboardV2Language;
   userId: string;
   joinedAt?: string | null;
   /** The effective limit (0 when unverified). */
   limit: number;
   /** When their open full-limit loan was funded, if they have one (a pre-Nov-14 loan keeps the old step). */
   openFundedAt?: string | null;
   /** Sample track for preview hosts. */
   preview?: CreditTrack;
   /** Preview the Track B pre-switch loan ($20 → $40 → $45). */
   previewPromise?: boolean;
}) {
   const track = preview ?? getCreditTrack(joinedAt);
   const shownLimit = preview ? 20 : limit;
   const key = seenKey(userId || 'preview', track, shownLimit);
   const [dismissed, setDismissed] = useState(false);
   if (!shouldShowCreditTrackCard(track, shownLimit) || dismissed || (!preview && readSeen(key))) return null;

   const copy = COPY[language] ?? COPY.en;
   const joined = preview ? (track === 'A' ? '2026-09-01' : '2026-11-01') : joinedAt;
   const fundedAt = preview ? (previewPromise ? '2026-11-10' : null) : openFundedAt;
   const first = getNextCreditTier(shownLimit, joined, fundedAt);
   const second = getNextCreditTier(first, joined);
   const steps = [...new Set([shownLimit, first, second])].filter((amount) => amount <= MAX_CREDIT_LIMIT);
   // Track B, but this loan keeps the old step: say what it unlocks, then the +$10 steps.
   const isPromise = track === 'B' && first - shownLimit > 10;
   const body = isPromise ? copy.promise(first) : copy[track].body;
   const dismiss = () => {
      setDismissed(true);
      try {
         window.localStorage.setItem(key, '1');
      } catch {
         // Storage blocked: it shows again next visit.
      }
   };

   return (
      <section
         className="mx-5 flex flex-col gap-3 rounded-[20px] border border-[#f1d58a] bg-[#fff8e1] px-4 py-4 dark:border-[#5a4818] dark:bg-[#2a2210]"
         aria-label={copy[track].title}
         data-testid={`credit-track-card-${track}`}
      >
         <p className="text-[18px] font-black leading-6 text-[#6b4a00] dark:text-[#ffe27a]">{copy[track].title}</p>
         <div className="flex items-center gap-2">
            {steps.map((amount, i) => (
               <span key={amount} className="flex items-center gap-2">
                  {i > 0 ? <span className="text-[16px] font-bold text-[#b08a2e]">→</span> : null}
                  <span
                     className={`rounded-full px-3 py-1 text-[16px] font-black ${
                        i === 0
                           ? 'bg-[#ffce1b] text-[#704518]'
                           : 'border border-[#f1d58a] bg-white text-[#6b4a00] dark:border-[#5a4818] dark:bg-[#3a2f14] dark:text-[#ffe27a]'
                     }`}
                  >
                     ${amount}
                  </span>
               </span>
            ))}
         </div>
         <p className="text-[14px] leading-[20px] text-[#6b5a2e] dark:text-[#e8d9a8]">{body}</p>
         <button
            type="button"
            className="flex h-[42px] w-full items-center justify-center rounded-full bg-[#ffce1b] text-[15px] font-bold text-[#704518] shadow-[0_-2px_1px_rgba(255,255,255,0.3),0_2px_1px_rgba(63,89,79,0.4)]"
            onClick={dismiss}
         >
            {copy.button}
         </button>
      </section>
   );
}
