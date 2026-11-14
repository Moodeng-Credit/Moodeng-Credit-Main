import { useEffect, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check, ChevronDown, ChevronLeft, Copy, Lock, Share2, UserPlus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

import {
   AFFILIATE_SAMPLE,
   type AffiliateClaim,
   type AffiliateCode,
   affiliateMilestones,
   type AffiliateReferral,
   type AffiliateStage,
   affiliateTotals,
   fetchAffiliateDashboard,
   newPayouts,
   referralStage,
   referralStep,
   splitCodes,
   submitReferralClaim
} from '@/lib/affiliateDashboard';
import { DASHBOARD_V2_ASSETS } from '@/views/dashboard-v2/assets';
import { ShareSheet } from '@/views/dashboard-v2/DashboardV2Rewards';

/*
 * /affiliate — styled after the Figma "Milestone_9.23version" invite screen (high-five hippos, purple
 * code card with ticket cut-outs, gold button), its Loan Summary row and its milestone rows.
 * The layout is borrowed; the words are the affiliate program's ($ cash per friend who repays), not
 * the voucher program's "Free meal".
 */

const PURPLE = '#6b55f7';
const GOLD_GRADIENT = 'linear-gradient(90deg, #ffe27a 0%, #f6b73c 100%)';
const CARD_GRADIENT = 'linear-gradient(160deg, #8f7dff 0%, #6b55f7 55%, #5a44e6 100%)';
const HERO_GRADIENT = 'linear-gradient(180deg, #7f86f6 0%, #8c94f7 100%)';
const SEEN_KEY = 'moodeng_affiliate_paid_seen';

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const readSeen = () => {
   try {
      return window.localStorage.getItem(SEEN_KEY);
   } catch {
      return null;
   }
};
const writeSeen = (iso: string) => {
   try {
      window.localStorage.setItem(SEEN_KEY, iso);
   } catch {
      /* private mode — the pop-up may show again, which is harmless */
   }
};

function useCopy() {
   const [copied, setCopied] = useState<string | null>(null);
   const copy = (value: string) => {
      void navigator.clipboard?.writeText(value).then(() => {
         setCopied(value);
         window.setTimeout(() => setCopied(null), 1500);
      });
   };
   return { copied, copy };
}

/* ---------- 1 · Hero ---------- */

function Hero({ payout }: { payout: number }) {
   return (
      <section
         className="relative -mx-5 overflow-hidden"
         // Fade the purple out at the bottom so it melts into the page behind the code card (no hard edge).
         style={{
            backgroundImage: HERO_GRADIENT,
            maskImage: 'linear-gradient(180deg, #000 72%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(180deg, #000 72%, transparent 100%)'
         }}
         aria-label="Earn by inviting friends"
      >
         <Link to="/dashboard" className="absolute left-4 top-5 z-10 text-white" aria-label="Back to dashboard">
            <ChevronLeft className="h-7 w-7" strokeWidth={2.4} />
         </Link>
         <div className="px-6 pt-12 text-center">
            <p
               className="text-[44px] font-black italic leading-none tracking-[-1px] text-[#fff6b8]"
               style={{ textShadow: '0 3px 0 rgba(91,68,230,0.35)' }}
            >
               EARN {money(payout)}
            </p>
            <p className="mt-1 text-[20px] font-extrabold italic leading-6 text-white">for every friend who repays</p>
         </div>
         <img
            src={DASHBOARD_V2_ASSETS.affiliateHero}
            alt="Two Moodeng hippos high-fiving"
            className="-mt-2 block w-full"
            style={{
               maskImage: 'linear-gradient(180deg, transparent 0%, #000 16%)',
               WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 16%)'
            }}
         />
      </section>
   );
}

/* ---------- 2–3 · Code ticket + other codes ---------- */

function TicketNotch({ side }: { side: 'left' | 'right' }) {
   return (
      <span
         aria-hidden
         className={clsx('absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full', side === 'left' ? '-left-2' : '-right-2')}
         style={{ backgroundColor: PURPLE }}
      />
   );
}

function CodeCard({ main, others, onShare }: { main: AffiliateCode; others: AffiliateCode[]; onShare: () => void }) {
   const { copied, copy } = useCopy();
   const [showOthers, setShowOthers] = useState(false);
   return (
      <section
         className="relative z-10 -mt-10 rounded-[22px] p-4 pb-5 shadow-[0_12px_30px_rgba(107,85,247,0.28)]"
         style={{ backgroundImage: CARD_GRADIENT }}
      >
         <h2 className="px-1 text-[22px] font-black italic leading-7 text-white" style={{ textShadow: '0 2px 0 rgba(60,40,140,0.45)' }}>
            My Referral Code
         </h2>

         <div className="mt-3 flex gap-2.5">
            {/* Main ticket: the code. Tap to copy. */}
            <button
               type="button"
               onClick={() => copy(main.code)}
               className="relative flex-1 overflow-visible rounded-[14px] bg-gradient-to-b from-white to-[#ece8ff] px-3 pb-3 pt-2.5 text-left"
               aria-label={`Copy code ${main.code}`}
            >
               <span className="inline-block -rotate-3 rounded-[6px] bg-[#e6dcff] px-2 py-0.5 text-[12px] font-extrabold italic text-[#6b55f7]">
                  Your code
               </span>
               <span className="mt-1 block break-all font-mono text-[26px] font-black leading-8 tracking-wide text-[#3d2f8f]">
                  {main.code}
               </span>
               <span className="mt-2 block border-t border-dashed border-[#b9aeff]" />
               <TicketNotch side="left" />
               <TicketNotch side="right" />
               <span className="mt-2 flex items-center gap-1 text-[13px] font-semibold text-[#6b55f7]">
                  {copied === main.code ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === main.code ? 'Copied!' : 'Tap to copy'}
               </span>
            </button>

            {/* Stub: what each friend is worth (and the friend's boost, only when there is one). */}
            <div className="flex w-[118px] shrink-0 flex-col gap-2">
               <div className="flex flex-1 flex-col items-center justify-center rounded-[14px] bg-gradient-to-b from-white to-[#ece8ff] px-2 py-2 text-center">
                  <span className="text-[30px] font-black italic leading-8 text-[#6b55f7]">{money(main.payout_amount)}</span>
                  <span className="text-[11px] font-semibold uppercase leading-3 tracking-wide text-[#8b7afa]">
                     for you, per friend who repays
                  </span>
               </div>
               {main.boost_amount > 0 ? (
                  <div className="rounded-[14px] bg-gradient-to-b from-[#fff7c9] to-[#ffe27a] px-2 py-1.5 text-center">
                     <span className="block text-[11px] font-extrabold italic text-[#7a4d00]">For your friend</span>
                     <span className="block text-[13px] font-bold leading-4 text-[#6b55f7]">+{money(main.boost_amount)} loan limit</span>
                  </div>
               ) : null}
            </div>
         </div>

         <button
            type="button"
            onClick={onShare}
            className="mt-4 flex h-[50px] w-full items-center justify-center gap-2 rounded-full text-[17px] font-extrabold text-[#5a3b00] shadow-[0_4px_0_#d99a1f]"
            style={{ backgroundImage: GOLD_GRADIENT }}
         >
            <Share2 className="h-5 w-5" strokeWidth={2.4} />
            Share my code
         </button>

         <p className="mt-3 px-1 text-center text-[13px] leading-[18px] text-white/85">
            Friends type <b className="text-white">{main.code}</b> when they ask for their first loan.
         </p>

         {others.length ? (
            <div className="mt-3 rounded-[12px] bg-white/10 px-3 py-2">
               <button
                  type="button"
                  onClick={() => setShowOthers((v) => !v)}
                  className="flex w-full items-center justify-between text-[13px] font-semibold text-white/90"
                  aria-expanded={showOthers}
               >
                  Other codes ({others.length})
                  <ChevronDown className={clsx('h-4 w-4 transition-transform', showOthers && 'rotate-180')} />
               </button>
               {showOthers ? (
                  <ul className="mt-2 flex flex-col gap-1.5">
                     {others.map((c) => (
                        <li key={c.code} className="flex items-center justify-between gap-2">
                           <span className="font-mono text-[15px] font-bold text-white">{c.code}</span>
                           <button
                              type="button"
                              onClick={() => copy(c.code)}
                              className="flex items-center gap-1 text-[13px] font-semibold text-[#fff6b8]"
                           >
                              {copied === c.code ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                              {copied === c.code ? 'Copied' : 'Copy'}
                           </button>
                        </li>
                     ))}
                  </ul>
               ) : null}
            </div>
         ) : null}
      </section>
   );
}

/* ---------- 4 · Money row (Figma "Loan Summary") ---------- */

function MoneyRow({ owed, pending, paid }: { owed: number; pending: number; paid: number }) {
   const cells = [
      { label: 'Owed to you', value: owed, strong: owed > 0 },
      { label: 'On the way', value: pending, strong: false },
      { label: 'Paid so far', value: paid, strong: false }
   ];
   return (
      <section className="mt-6" aria-label="Your money">
         <h2 className="text-[20px] font-bold italic leading-6 text-[#594d65] dark:text-[#d9cfe6]">Your Money</h2>
         <div className="mt-3 flex rounded-[14px] bg-dv2-card px-2 py-4">
            {cells.map((c, i) => (
               <div key={c.label} className={clsx('flex-1 px-2', i > 0 && 'border-l border-[#ece9f1] dark:border-[#2c2439]')}>
                  <p
                     className={clsx(
                        'text-[26px] font-bold leading-8',
                        c.strong
                           ? 'text-[#e39b12]'
                           : c.value > 0
                             ? 'text-[#6b55f7] dark:text-[#b3a6ff]'
                             : 'text-[#c9c1d4] dark:text-[#5b5068]'
                     )}
                  >
                     {money(c.value)}
                  </p>
                  <p className="text-[13px] font-medium leading-4 text-[#7b6b8c] dark:text-[#cfc4dd]">{c.label}</p>
               </div>
            ))}
         </div>
         {pending > 0 ? (
            <p className="mt-2 px-1 text-[13px] leading-[18px] text-[#7b6b8c] dark:text-[#a99cba]">
               &ldquo;On the way&rdquo; becomes yours when those friends repay their loan.
            </p>
         ) : null}
      </section>
   );
}

/* ---------- 10 · Milestones (badges only) ---------- */

function Milestones({ referrals }: { referrals: AffiliateReferral[] }) {
   const items = affiliateMilestones(referrals);
   const nextIndex = items.findIndex((m) => !m.done);
   return (
      <section className="mt-6" aria-label="Affiliate milestones">
         <h2 className="text-[20px] font-bold italic leading-6 text-[#594d65] dark:text-[#d9cfe6]">Milestones</h2>
         <ul className="mt-3 overflow-hidden rounded-[14px] bg-dv2-card">
            {items.map((m, i) => {
               const isNext = i === nextIndex;
               return (
                  <li
                     key={m.goal}
                     className={clsx(
                        'flex items-center gap-3 px-3 py-3',
                        i > 0 && 'border-t border-[#ece9f1] dark:border-[#2c2439]',
                        isNext && 'bg-gradient-to-r from-[#fff3c4] to-transparent dark:from-[#3b3216]'
                     )}
                  >
                     <img
                        src={DASHBOARD_V2_ASSETS.pandesal}
                        alt=""
                        className={clsx('h-9 w-9 shrink-0', !m.done && !isNext && 'opacity-50 grayscale')}
                     />
                     <div className="min-w-0 flex-1">
                        <p
                           className={clsx(
                              'text-[16px] font-medium leading-5',
                              isNext ? 'text-[#a35f00] dark:text-[#ffd27a]' : 'text-[#2f2540] dark:text-[#e6def2]'
                           )}
                        >
                           {m.title}
                        </p>
                        <p className={clsx('text-[13px] leading-4', isNext ? 'text-[#e39b12]' : 'text-[#7b6b8c] dark:text-[#a99cba]')}>
                           {m.progress}/{m.goal} friends
                        </p>
                     </div>
                     {m.done ? (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-[13px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                           Done
                        </span>
                     ) : isNext ? (
                        <span
                           className="rounded-full px-3 py-1 text-[13px] font-semibold text-white"
                           style={{ backgroundImage: 'linear-gradient(77deg, #9584ff, #6b55f7)' }}
                        >
                           Next
                        </span>
                     ) : (
                        <Lock className="h-4 w-4 text-[#c0b9c8]" aria-label="Locked" />
                     )}
                  </li>
               );
            })}
         </ul>
      </section>
   );
}

/* ---------- 5–6 · Friends with a 3-step track ---------- */

const STEP_LABELS = ['Signed up', 'Took a loan', 'Repaid'] as const;

function StepTrack({ step, tone }: { step: 1 | 2 | 3; tone: 'purple' | 'gold' | 'green' }) {
   const on = tone === 'gold' ? '#f6b73c' : tone === 'green' ? '#10b981' : PURPLE;
   return (
      <div className="mt-2 flex items-center" aria-label={`Step ${step} of 3: ${STEP_LABELS[step - 1]}`}>
         {STEP_LABELS.map((label, i) => {
            const reached = i < step;
            return (
               <div key={label} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center">
                     <span
                        className="h-3 w-3 rounded-full border-2"
                        style={{ backgroundColor: reached ? on : 'transparent', borderColor: reached ? on : '#d6cfe0' }}
                     />
                  </div>
                  {i < STEP_LABELS.length - 1 ? (
                     <span className="mx-1 h-[2px] flex-1 rounded-full" style={{ backgroundColor: i + 1 < step ? on : '#e4dfeb' }} />
                  ) : null}
               </div>
            );
         })}
      </div>
   );
}

const PILL: Record<AffiliateStage, string> = {
   paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
   repaid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
   owed: 'bg-[#f6b73c] text-[#5a3b00]',
   borrowed: 'bg-[#ece9ff] text-[#6b55f7] dark:bg-[#2a2448] dark:text-[#b3a6ff]',
   signed_up: 'bg-[#f1eff4] text-[#7b6b8c] dark:bg-[#2a2235] dark:text-[#cfc4dd]'
};

function pillText(r: AffiliateReferral, stage: AffiliateStage) {
   if (stage === 'paid') return `Paid ${money(r.payout_amount)}`;
   if (stage === 'owed') return `${money(r.payout_amount)} owed`;
   if (stage === 'repaid') return 'Repaid';
   if (stage === 'borrowed') return 'Has a loan';
   return 'Signed up';
}

function hintText(r: AffiliateReferral, stage: AffiliateStage) {
   if (stage === 'paid') return r.paid_at ? `We paid you on ${shortDate(r.paid_at)}` : 'We paid you';
   if (stage === 'owed') return 'They repaid — we’ll send your money';
   if (r.claimed) return 'Added by you · tracked, no payout';
   if (stage === 'borrowed') return `You get ${money(r.payout_amount)} when they repay`;
   return 'Waiting for their first loan';
}

function FriendRow({ r, index, showCode }: { r: AffiliateReferral; index: number; showCode: boolean }) {
   const stage = referralStage(r);
   const tone = stage === 'owed' ? 'gold' : stage === 'paid' || stage === 'repaid' ? 'green' : 'purple';
   return (
      <li
         className={clsx(
            'px-3 py-3',
            index > 0 && 'border-t border-[#ece9f1] dark:border-[#2c2439]',
            stage === 'owed' && 'bg-gradient-to-r from-[#fff3c4] to-[#fffaf0] dark:from-[#3b3216] dark:to-transparent',
            stage === 'paid' && 'bg-emerald-50/60 dark:bg-emerald-900/10'
         )}
      >
         <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
               <p className="truncate text-[17px] font-medium leading-5 text-[#2f2540] dark:text-[#e6def2]">{r.first_name}</p>
               <p className="text-[13px] leading-4 text-[#7b6b8c] dark:text-[#a99cba]">
                  Joined {shortDate(r.joined_at)}
                  {showCode ? ` · ${r.code}` : ''}
               </p>
            </div>
            <span className={clsx('shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold', PILL[stage])}>{pillText(r, stage)}</span>
         </div>
         <StepTrack step={referralStep(r)} tone={tone} />
         <p
            className={clsx(
               'mt-1.5 text-[13px] leading-4',
               stage === 'owed' ? 'font-semibold text-[#a35f00] dark:text-[#ffd27a]' : 'text-[#7b6b8c] dark:text-[#a99cba]'
            )}
         >
            {hintText(r, stage)}
         </p>
      </li>
   );
}

function Friends({
   referrals,
   showCode,
   payout,
   onShare
}: {
   referrals: AffiliateReferral[];
   showCode: boolean;
   payout: number;
   onShare: () => void;
}) {
   return (
      <section className="mt-6" aria-label="Your friends">
         <h2 className="text-[20px] font-bold italic leading-6 text-[#594d65] dark:text-[#d9cfe6]">Your Friends</h2>
         <p className="mt-1 text-[13px] leading-4 text-[#7b6b8c] dark:text-[#a99cba]">
            Signed up → Took a loan → Repaid = <b className="text-[#6b55f7] dark:text-[#b3a6ff]">{money(payout)} for you</b>
         </p>
         {referrals.length ? (
            <ul className="mt-3 overflow-hidden rounded-[14px] bg-dv2-card">
               {referrals.map((r, i) => (
                  <FriendRow key={`${r.code}-${r.joined_at}-${i}`} r={r} index={i} showCode={showCode} />
               ))}
            </ul>
         ) : (
            /* 7 · Empty state */
            <div className="mt-3 flex flex-col items-center rounded-[14px] bg-dv2-card px-5 py-6 text-center">
               <img src={DASHBOARD_V2_ASSETS.emptyMoodeng} alt="" className="h-[110px] w-auto" />
               <p className="mt-3 text-[17px] font-semibold text-[#594d65] dark:text-[#e6def2]">
                  Share your code to earn your first {money(payout)}
               </p>
               <button
                  type="button"
                  onClick={onShare}
                  className="mt-4 flex h-[46px] items-center gap-2 rounded-full px-6 text-[16px] font-extrabold text-[#5a3b00] shadow-[0_3px_0_#d99a1f]"
                  style={{ backgroundImage: GOLD_GRADIENT }}
               >
                  <Share2 className="h-4 w-4" strokeWidth={2.4} />
                  Share my code
               </button>
            </div>
         )}
      </section>
   );
}

/* ---------- 8 · Add a friend (small, honest about no payout) ---------- */

function ClaimFriend({ claims, sample }: { claims: AffiliateClaim[]; sample: boolean }) {
   const queryClient = useQueryClient();
   const [open, setOpen] = useState(false);
   const [name, setName] = useState('');
   const [contact, setContact] = useState('');
   const [sent, setSent] = useState<string | null>(null);
   const mutation = useMutation({
      mutationFn: () => (sample ? Promise.resolve() : submitReferralClaim(name.trim(), contact.trim())),
      onSuccess: () => {
         setSent(name.trim());
         setName('');
         setContact('');
         setOpen(false);
         void queryClient.invalidateQueries({ queryKey: ['affiliate-dashboard'] });
      }
   });
   const errorText = (mutation.error as { message?: string } | null)?.message;
   const field =
      'h-[44px] rounded-[10px] border border-[#e1dbe8] bg-white px-3 text-[16px] text-[#594d65] dark:border-[#3a3047] dark:bg-[#1d1726] dark:text-[#e6def2]';

   return (
      <section className="mt-6 px-1" aria-label="Add a friend you referred">
         {open ? (
            <div className="rounded-[14px] bg-dv2-card p-4">
               <p className="text-[16px] font-semibold text-[#594d65] dark:text-[#e6def2]">Friend didn&apos;t type your code?</p>
               <p className="mt-1 text-[13px] leading-[18px] text-[#7b6b8c] dark:text-[#a99cba]">
                  We&apos;ll find them and show them in your list so you can follow along. Only friends who typed your code earn you money.
               </p>
               <form
                  className="mt-3 flex flex-col gap-2"
                  onSubmit={(e) => {
                     e.preventDefault();
                     if (name.trim().length >= 2) mutation.mutate();
                  }}
               >
                  <input
                     value={name}
                     onChange={(e) => setName(e.target.value)}
                     placeholder="Their name (as on Facebook)"
                     maxLength={80}
                     autoFocus
                     className={field}
                  />
                  <input
                     value={contact}
                     onChange={(e) => setContact(e.target.value)}
                     placeholder="Phone or Facebook link (optional)"
                     maxLength={120}
                     className={field}
                  />
                  {errorText ? <p className="text-[14px] text-red-600 dark:text-red-400">{errorText}</p> : null}
                  <button
                     type="submit"
                     disabled={name.trim().length < 2 || mutation.isPending}
                     className="h-[44px] rounded-full text-[16px] font-semibold text-white disabled:opacity-50"
                     style={{ backgroundImage: 'linear-gradient(77deg, #9584ff, #6b55f7)' }}
                  >
                     {mutation.isPending ? 'Sending…' : 'Send to Moodeng'}
                  </button>
                  <button
                     type="button"
                     onClick={() => setOpen(false)}
                     className="text-[14px] font-medium text-[#7b6b8c] dark:text-[#a99cba]"
                  >
                     Cancel
                  </button>
               </form>
            </div>
         ) : (
            <button
               type="button"
               onClick={() => {
                  setSent(null);
                  setOpen(true);
               }}
               className="mx-auto flex items-center gap-1.5 text-[14px] font-semibold text-[#6b55f7] dark:text-[#b3a6ff]"
            >
               <UserPlus className="h-4 w-4" />
               Friend didn&apos;t type your code? Add them
            </button>
         )}
         {sent ? (
            <p className="mt-3 rounded-[10px] bg-emerald-50 px-3 py-2 text-[14px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
               Got it — we&apos;re checking {sent}. They&apos;ll show up above once we find them.
            </p>
         ) : null}
         {claims.length ? (
            <ul className="mt-3 flex flex-col gap-1.5">
               {claims.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 text-[14px]">
                     <span className="truncate text-[#594d65] dark:text-[#e6def2]">{c.friend_name}</span>
                     <span
                        className={clsx(
                           'shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold',
                           c.status === 'pending'
                              ? 'bg-[#f1eff4] text-[#7b6b8c] dark:bg-[#2a2235] dark:text-[#cfc4dd]'
                              : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        )}
                     >
                        {c.status === 'pending' ? 'We’re checking' : 'Couldn’t find them'}
                     </span>
                  </li>
               ))}
            </ul>
         ) : null}
      </section>
   );
}

/* ---------- 11 · "You got paid" pop-up ---------- */

function PaidPopup({ amount, count, onClose }: { amount: number; count: number; onClose: () => void }) {
   return (
      <div
         className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-6"
         role="dialog"
         aria-modal="true"
         aria-labelledby="aff-paid-title"
         onClick={onClose}
      >
         <div
            className="w-full max-w-[340px] rounded-[24px] bg-white px-5 pb-6 pt-5 text-center dark:bg-[#1d1726]"
            onClick={(e) => e.stopPropagation()}
         >
            <img src="/hippos/party.png" alt="" className="mx-auto h-[130px] w-auto" />
            <p id="aff-paid-title" className="mt-2 text-[30px] font-black italic leading-9 text-[#6b55f7] dark:text-[#b3a6ff]">
               You got paid {money(amount)}!
            </p>
            <p className="mt-1 text-[15px] leading-5 text-[#594d65] dark:text-[#cfc4dd]">
               {count === 1 ? 'A friend you invited repaid their loan.' : `${count} friends you invited repaid their loans.`} Thank you for
               spreading the word!
            </p>
            <button
               type="button"
               onClick={onClose}
               className="mt-5 h-[48px] w-full rounded-full text-[17px] font-extrabold text-[#5a3b00] shadow-[0_3px_0_#d99a1f]"
               style={{ backgroundImage: GOLD_GRADIENT }}
            >
               Nice!
            </button>
         </div>
      </div>
   );
}

/* ---------- Page ---------- */

export default function AffiliateDashboardPage({ sample = false }: { sample?: boolean }) {
   const [searchParams] = useSearchParams();
   const query = useQuery({
      queryKey: ['affiliate-dashboard'],
      queryFn: fetchAffiliateDashboard,
      staleTime: 30_000,
      enabled: !sample
   });
   // /affiliate-preview (dev only) renders made-up referrals so the page can be checked signed out.
   const { data, isLoading, error } = sample ? { data: AFFILIATE_SAMPLE, isLoading: false, error: null } : query;
   const referrals = data?.referrals ?? [];
   const codes = data?.codes ?? [];
   const totals = affiliateTotals(referrals);
   const { main, others } = splitCodes(codes, referrals);

   const [sharing, setSharing] = useState(false);
   const [shareCopied, setShareCopied] = useState(false);
   const [paidPopup, setPaidPopup] = useState<{ amount: number; count: number; latest: string } | null>(null);

   useEffect(() => {
      if (!data) return;
      // ?popup=1 forces the pop-up in the preview so it can be checked.
      if (sample) {
         if (searchParams.get('popup') === '1') setPaidPopup({ amount: 10, count: 1, latest: new Date().toISOString() });
         return;
      }
      const fresh = newPayouts(data.referrals, readSeen());
      if (fresh.count && fresh.latest) setPaidPopup({ amount: fresh.amount, count: fresh.count, latest: fresh.latest });
   }, [data, sample, searchParams]);

   const closePaidPopup = () => {
      if (paidPopup && !sample) writeSeen(paidPopup.latest);
      setPaidPopup(null);
   };

   const shareLink = typeof window !== 'undefined' ? window.location.origin : 'https://moodeng.app';
   const shareText = main
      ? `I use Moodeng Credit for small loans. Sign up and type my code ${main.code} when you ask for your first loan:`
      : '';

   if (isLoading || error || !main) {
      return (
         <div className="min-h-screen bg-dv2-page">
            <div className="mx-auto max-w-[440px] px-5 pb-28">
               <header className="relative flex h-16 items-end justify-center pb-1">
                  <Link
                     to="/dashboard"
                     className="absolute bottom-1 left-0 text-[#594d65] dark:text-[#d9cfe6]"
                     aria-label="Back to dashboard"
                  >
                     <ChevronLeft className="h-6 w-6" strokeWidth={2} />
                  </Link>
                  <h1 className="text-[24px] font-semibold leading-[1.1] tracking-[-0.48px] text-[#594d65] dark:text-[#e6def2]">
                     Affiliate dashboard
                  </h1>
               </header>
               {isLoading ? (
                  <div className="mt-8 flex flex-col gap-3" aria-busy="true" aria-label="Loading affiliate dashboard">
                     {['a1', 'a2', 'a3'].map((id) => (
                        <div key={id} className="h-[90px] animate-pulse rounded-[12px] bg-[#ece9f1] dark:bg-dv2-card" />
                     ))}
                  </div>
               ) : error ? (
                  <p className="mt-8 rounded-[12px] bg-dv2-card p-4 text-[16px] text-[#45556c] dark:text-[#b9adc9]">
                     We couldn&apos;t load your dashboard. Pull to refresh or try again in a minute.
                  </p>
               ) : (
                  <div className="mt-8 rounded-[12px] bg-dv2-card p-5 text-center">
                     <p className="text-[20px] font-semibold text-[#594d65] dark:text-[#e6def2]">No affiliate code on this account</p>
                     <p className="mt-2 text-[15px] leading-5 text-[#45556c] dark:text-[#b9adc9]">
                        If you&apos;re a Moodeng affiliate, make sure you&apos;re signed in with the account we linked your code to, or
                        message us and we&apos;ll set it up.
                     </p>
                  </div>
               )}
            </div>
         </div>
      );
   }

   return (
      <div className="min-h-screen bg-dv2-page">
         <div className="mx-auto max-w-[440px] px-5 pb-28">
            <h1 className="sr-only">Affiliate dashboard</h1>
            <Hero payout={main.payout_amount} />
            <CodeCard main={main} others={others} onShare={() => setSharing(true)} />
            <MoneyRow owed={totals.owed} pending={totals.pending} paid={totals.paid} />
            <Friends referrals={referrals} showCode={codes.length > 1} payout={main.payout_amount} onShare={() => setSharing(true)} />
            <Milestones referrals={referrals} />
            <ClaimFriend claims={data?.claims ?? []} sample={sample} />
         </div>

         {sharing ? (
            <ShareSheet
               link={shareLink}
               text={shareText}
               title="Small loans on Moodeng Credit"
               copyText={`${shareText} ${shareLink}`}
               onClose={() => setSharing(false)}
               onCopied={() => {
                  setShareCopied(true);
                  window.setTimeout(() => setShareCopied(false), 1500);
               }}
            />
         ) : null}
         {shareCopied ? (
            <div className="fixed bottom-24 left-1/2 z-[95] -translate-x-1/2 rounded-full bg-[#2f2540] px-4 py-2 text-[14px] font-semibold text-white">
               Message copied
            </div>
         ) : null}
         {paidPopup ? <PaidPopup amount={paidPopup.amount} count={paidPopup.count} onClose={closePaidPopup} /> : null}
      </div>
   );
}
