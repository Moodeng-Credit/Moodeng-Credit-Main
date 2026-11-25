import { type ReactNode, useState } from 'react';

import { CalendarDays, Check, Lock, Wallet } from 'lucide-react';

import { type LoanRulesView, money, pesos, shortDay } from '@/lib/loanRequestCards';
import { useUsdcRate } from '@/lib/useUsdcRate';
import { CONNECT_HIPPOS, GhostButton, PrimaryButton } from '@/views/dashboard/components/connectKit';

// The two request cards (George, 2026-11-25, honest wording): funding is still done by hand, so
// nothing here says "ready" or "sent to you". Card 1 sits at the top of the terms step; card 2 is the
// last thing they see before the request goes out ("I understand, send my request") and is recorded.

const GOLD_TEXT = 'text-[#b07800] dark:text-[#ffe27a]';




function Pill({ children }: { children: ReactNode }) {
   return (
      <span className="mx-auto rounded-full bg-[#f1ecff] px-3 py-1 text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#6b55f7] dark:bg-[#2a1740] dark:text-[#b4a6ff]">
         {children}
      </span>
   );
}

function Row({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string }) {
   return (
      <li className="flex items-center gap-2.5 rounded-[16px] bg-[#f4f2f8] px-3 py-2.5 dark:bg-[#211a2d]">
         <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[#6b55f7] dark:bg-[#33294a] dark:text-[#b4a6ff]">
            {icon}
         </span>
         <span className="min-w-0 flex-1 text-[15px] font-semibold leading-[19px] text-[#3d3350] dark:text-[#e8e0f5]">{label}</span>
         <span className="shrink-0 text-right">
            <span className="block text-[16px] font-extrabold leading-[19px] text-[#1f1b29] dark:text-white">{value}</span>
            {sub ? <span className="block text-[12px] font-semibold leading-[15px] text-[#8f86a0] dark:text-[#a99cb8]">{sub}</span> : null}
         </span>
      </li>
   );
}

/**
 * Card 1 — what they're asking for, in pesos too. The amount field (passed in) stays hidden behind
 * "Change amount" until they want less than the pre-filled limit, or the amount has an error.
 */
export function LoanRequestCard({
   amount,
   total,
   dueIso,
   isFirstLoan,
   limit,
   amountEditor,
   showEditor
}: {
   amount: number;
   limit: number;
   total: number | null;
   dueIso: string;
   isFirstLoan: boolean;
   amountEditor: ReactNode;
   showEditor: boolean;
}) {
   const rate = useUsdcRate('php').value;
   const [editing, setEditing] = useState(false);
   const open = editing || showEditor;
   const valid = Number.isFinite(amount) && amount > 0;
   const day = shortDay(dueIso);

   return (
      <section aria-label="Your loan request" className="flex flex-col gap-3 rounded-[24px] border border-[#ece6f6] bg-gradient-to-b from-[#f6f2ff] to-white px-4 pb-4 pt-3 dark:border-[#3a2d52] dark:from-[#241838] dark:to-[#1b1427]">
         <Pill>{isFirstLoan ? '✓ Your first loan' : 'Your loan request'}</Pill>
         <img alt="" aria-hidden="true" className="mx-auto h-[112px] w-auto object-contain" src={CONNECT_HIPPOS.approved} />
         <div className="text-center">
            <p className="text-[22px] font-extrabold leading-[26px] text-[#1f1b29] dark:text-white">You're asking for</p>
            <p className={`mt-1 text-[34px] font-extrabold leading-[40px] ${GOLD_TEXT}`}>
               {valid ? `${money(amount)} ≈ ${pesos(amount, rate)}` : '—'}
            </p>
         </div>
         <ul className="flex flex-col gap-2">
            <Row
               icon={<Wallet className="size-4" strokeWidth={2.4} />}
               label="You get, once a lender sends it"
               value={valid ? money(amount) : '—'}
               sub={valid ? `≈ ${pesos(amount, rate)}` : undefined}
            />
            <Row
               icon={<CalendarDays className="size-4" strokeWidth={2.4} />}
               label={day ? `You pay back by ${day}` : 'You pay back'}
               value={total === null || !valid ? '—' : money(total)}
               sub={total === null || !valid ? undefined : `≈ ${pesos(total, rate)}`}
            />
         </ul>
         <p className="text-center text-[13px] font-semibold leading-[17px] text-[#8f86a0] dark:text-[#a99cb8]">30 days · 10% on top · same for everyone</p>
         {open ? (
            amountEditor
         ) : (
            <>
            <p className="text-center text-[13px] font-semibold text-[#8f86a0] dark:text-[#a99cb8]">Your limit: {money(limit)}</p>
            <button
               className="mx-auto text-[15px] font-bold text-[#6b55f7] underline-offset-4 hover:underline dark:text-[#b4a6ff]"
               onClick={() => setEditing(true)}
               type="button"
            >
               Borrow less
            </button>
            </>
         )}
      </section>
   );
}



function WindowRow({ good, when, result }: { good: boolean; when: string; result: string }) {
   return (
      <li
         className={`flex items-center gap-2.5 rounded-[16px] border-2 px-3 py-2.5 text-left ${
            good ? 'border-[#9fe3b4] bg-[#eefbf2] dark:border-[#2f6b45] dark:bg-[#123222]' : 'border-transparent bg-[#f4f2f8] dark:bg-[#211a2d]'
         }`}
      >
         <span
            aria-hidden="true"
            className={`grid size-7 shrink-0 place-items-center rounded-full ${
               good ? 'bg-[#4aa256] text-white' : 'bg-[#e2dde9] text-[#8f86a0] dark:bg-[#33294a] dark:text-[#a99cb8]'
            }`}
         >
            {good ? <Check className="size-4" strokeWidth={3} /> : <Lock className="size-3.5" strokeWidth={2.5} />}
         </span>
         <span className={`min-w-0 flex-1 text-[14px] font-semibold leading-[18px] ${good ? 'text-[#1f5c33] dark:text-[#bfeccc]' : 'text-[#8f86a0] dark:text-[#a99cb8]'}`}>
            {when}
         </span>
         <span className={`shrink-0 text-[15px] font-extrabold leading-[18px] ${good ? 'text-[#2f8a4a] dark:text-[#7fd693]' : 'text-[#8f86a0] dark:text-[#a99cb8]'}`}>
            {result}
         </span>
      </li>
   );
}

/** Card 2 — the 2-day rule, then the button that sends (or, if a step is left, continues). */
export function LoanRulesStep({
   view,
   ctaLabel,
   busy,
   onAgree,
   onBack
}: {
   view: LoanRulesView;
   ctaLabel: string;
   busy?: boolean;
   onAgree: () => void;
   onBack: () => void;
}) {
   const until = view.dueDay ? `Day 3 to ${view.dueDay}` : 'From day 3';
   return (
      <div className="flex flex-col gap-4 px-5 py-5">
         <Pill>⏳ Before you send</Pill>
         <img alt="" aria-hidden="true" className="mx-auto h-[150px] w-auto object-contain" src="/fast-repay/keep-two-days-v2.webp" />
         <div className="text-center">
            <h3 className="text-[24px] font-extrabold leading-[28px] text-[#1f1b29] dark:text-white">Keep your loan 2+ days</h3>
            {view.levelUp ? (
               <p className={`mt-1 text-[34px] font-extrabold leading-[40px] ${GOLD_TEXT}`}>
                  {money(view.levelUp.from)} → {money(view.levelUp.to)}
               </p>
            ) : null}
            <p className="mt-1 text-[14px] font-semibold leading-[18px] text-[#8f86a0] dark:text-[#a99cb8]">Counted from the day you get the money</p>
         </div>
         <ul className="flex flex-col gap-2">
            <WindowRow good={false} when="Repay in the first 2 days" result={view.levelUp ? `Stays ${money(view.levelUp.from)}` : 'Too early'} />
            <WindowRow good when={until} result={view.levelUp ? `Limit ${money(view.levelUp.to)}` : 'On time ✓'} />
         </ul>
         {view.levelUp ? null : (
            <p className="text-center text-[13px] font-semibold leading-[17px] text-[#8f86a0] dark:text-[#a99cb8]">Only a full-limit loan raises your limit.</p>
         )}
         <PrimaryButton disabled={busy} onClick={onAgree}>
            {busy ? 'Sending…' : ctaLabel}
         </PrimaryButton>
         <GhostButton onClick={onBack}>Back</GhostButton>
      </div>
   );
}

