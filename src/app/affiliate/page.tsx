import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check, ChevronLeft, Copy } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
   AFFILIATE_SAMPLE,
   type AffiliateReferral,
   type AffiliateStage,
   affiliateTotals,
   fetchAffiliateDashboard,
   referralStage
} from '@/lib/affiliateDashboard';

const PRIMARY_GRADIENT = 'linear-gradient(77.58deg, #9584ff 0.5%, #6b55f7 98.16%)';

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

const STAGE_PILL: Record<AffiliateStage, string> = {
   paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
   owed: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
   borrowed: 'bg-[#ece9ff] text-[#6b55f7] dark:bg-[#2a2448] dark:text-[#b3a6ff]',
   signed_up: 'bg-[#f1eff4] text-[#7b6b8c] dark:bg-[#2a2235] dark:text-[#cfc4dd]'
};

function stageLabel(r: AffiliateReferral, stage: AffiliateStage): string {
   if (stage === 'paid') return `Paid you ${money(r.payout_amount)}`;
   if (stage === 'owed') return `${money(r.payout_amount)} owed to you`;
   if (stage === 'borrowed') return 'Has a loan';
   return 'Signed up';
}

function stageHint(r: AffiliateReferral, stage: AffiliateStage): string {
   if (stage === 'paid') return r.paid_at ? `Paid ${new Date(r.paid_at).toLocaleDateString()}` : 'Paid';
   if (stage === 'owed') return 'Repaid their loan — we will send your money';
   if (stage === 'borrowed') return `You earn ${money(r.payout_amount)} when they repay`;
   return 'Waiting for their first loan';
}

function Stat({ label, value }: { label: string; value: number }) {
   return (
      <div className="flex-1 rounded-[12px] bg-dv2-card px-3 py-3 text-center">
         <p className="text-[28px] font-bold leading-8 text-[#594d65] dark:text-[#e6def2]">{value}</p>
         <p className="text-[13px] font-medium leading-4 text-[#7b6b8c] dark:text-[#cfc4dd]">{label}</p>
      </div>
   );
}

function CodeCard({ code, boost, payout }: { code: string; boost: number; payout: number }) {
   const [copied, setCopied] = useState(false);
   const copy = () => {
      void navigator.clipboard?.writeText(code).then(() => {
         setCopied(true);
         window.setTimeout(() => setCopied(false), 1500);
      });
   };
   return (
      <div className="rounded-[12px] bg-dv2-card p-4">
         <p className="text-[14px] font-medium text-[#7b6b8c] dark:text-[#cfc4dd]">Your code</p>
         <div className="mt-1 flex items-center justify-between gap-3">
            <span className="font-mono text-[28px] font-bold tracking-wide text-[#594d65] dark:text-[#e6def2]">{code}</span>
            <button
               type="button"
               onClick={copy}
               className="flex h-[36px] items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold text-white"
               style={{ backgroundImage: PRIMARY_GRADIENT }}
            >
               {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
               {copied ? 'Copied' : 'Copy'}
            </button>
         </div>
         <p className="mt-2 text-[14px] leading-5 text-[#45556c] dark:text-[#b9adc9]">
            Friends type <b>{code}</b> when they request their first loan and get <b>+{money(boost)}</b> credit. You earn{' '}
            <b>{money(payout)}</b> for each friend who takes a loan and repays it.
         </p>
      </div>
   );
}

/** /affiliate — a referral code owner's own dashboard: signups, pay per person, what we owe them. */
export default function AffiliateDashboardPage({ sample = false }: { sample?: boolean }) {
   const query = useQuery({
      queryKey: ['affiliate-dashboard'],
      queryFn: fetchAffiliateDashboard,
      staleTime: 30_000,
      enabled: !sample
   });
   // /affiliate-preview (dev only) renders made-up referrals so the page can be checked signed out.
   const { data, isLoading, error } = sample ? { data: AFFILIATE_SAMPLE, isLoading: false, error: null } : query;
   const totals = affiliateTotals(data?.referrals ?? []);
   const codes = data?.codes ?? [];

   return (
      <div className="min-h-screen bg-dv2-page">
         <div className="mx-auto max-w-[440px] px-5 pb-28">
            <header className="relative flex h-16 items-end justify-center pb-1">
               <Link to="/dashboard" className="absolute bottom-1 left-0 text-[#594d65] dark:text-[#d9cfe6]" aria-label="Back to dashboard">
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
            ) : !codes.length ? (
               <div className="mt-8 rounded-[12px] bg-dv2-card p-5 text-center">
                  <p className="text-[20px] font-semibold text-[#594d65] dark:text-[#e6def2]">No affiliate code on this account</p>
                  <p className="mt-2 text-[15px] leading-5 text-[#45556c] dark:text-[#b9adc9]">
                     If you&apos;re a Moodeng affiliate, make sure you&apos;re signed in with the account we linked your code to, or message
                     us and we&apos;ll set it up.
                  </p>
               </div>
            ) : (
               <>
                  <section
                     className="mt-6 rounded-[16px] p-5 text-white"
                     style={{ backgroundImage: PRIMARY_GRADIENT }}
                     aria-label="What we owe you"
                  >
                     <p className="text-[15px] font-medium opacity-90">We owe you</p>
                     <p className="text-[44px] font-bold leading-[1.1]">{money(totals.owed)}</p>
                     <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[14px] font-medium opacity-90">
                        <span>Paid so far {money(totals.paid)}</span>
                        <span>Earned total {money(totals.earned)}</span>
                        {totals.pending > 0 ? <span>On the way {money(totals.pending)}</span> : null}
                     </div>
                  </section>

                  <div className="mt-4 flex gap-2">
                     <Stat label="Signed up" value={totals.signedUp} />
                     <Stat label="Took a loan" value={totals.borrowed} />
                     <Stat label="Repaid" value={totals.repaid} />
                  </div>

                  <div className="mt-4 flex flex-col gap-3">
                     {codes.map((c) => (
                        <CodeCard key={c.code} code={c.code} boost={c.boost_amount} payout={c.payout_amount} />
                     ))}
                  </div>

                  <h2 className="mt-8 text-[20px] font-bold italic leading-6 text-[#594d65] dark:text-[#d9cfe6]">Your referrals</h2>
                  {data?.referrals.length ? (
                     <ul className="mt-3 rounded-[12px] bg-dv2-card px-3 py-1">
                        {data.referrals.map((r, index) => {
                           const stage = referralStage(r);
                           return (
                              <li
                                 key={`${r.code}-${r.joined_at}-${index}`}
                                 className={clsx(
                                    'flex items-center gap-3 py-3',
                                    index > 0 && 'border-t border-[#ece9f1] dark:border-[#2c2439]'
                                 )}
                              >
                                 <div className="min-w-0 flex-1">
                                    <p className="truncate text-[17px] font-medium text-[#594d65] dark:text-[#e6def2]">{r.first_name}</p>
                                    <p className="text-[13px] leading-4 text-[#7b6b8c] dark:text-[#a99cba]">
                                       Joined {new Date(r.joined_at).toLocaleDateString()}
                                       {codes.length > 1 ? ` · ${r.code}` : ''} · {stageHint(r, stage)}
                                    </p>
                                 </div>
                                 <span className={clsx('shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold', STAGE_PILL[stage])}>
                                    {stageLabel(r, stage)}
                                 </span>
                              </li>
                           );
                        })}
                     </ul>
                  ) : (
                     <p className="mt-3 rounded-[12px] bg-dv2-card p-4 text-[15px] text-[#45556c] dark:text-[#b9adc9]">
                        No one has used your code yet. Share it with friends who need a small loan.
                     </p>
                  )}
               </>
            )}
         </div>
      </div>
   );
}
