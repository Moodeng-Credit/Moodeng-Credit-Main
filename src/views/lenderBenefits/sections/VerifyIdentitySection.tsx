import { type JSX } from 'react';

import { ArrowRight, LockKeyhole, UserCheck } from 'lucide-react';

const listData = [
   {
      title: 'World ID helps confirm one real person behind each borrower account.'
   },
   {
      title: 'Moodeng can show verification status without storing passport-style documents.'
   },
   {
      title: 'Lenders still evaluate loan terms, history, and repayment behavior before funding.'
   }
];

export default function VerifyIdentitySection(): JSX.Element {
   return (
      <div className="lender-world-identity mt-9 flex max-w-full flex-col self-center rounded-[32px] px-8 py-8 text-white shadow-[0px_18px_50px_rgba(0,0,0,0.22)] w-[860px] max-md:px-5">
         <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.14em] text-white/70">
            <UserCheck className="size-5" />
            Identity layer
         </div>
         <div className="mt-4 text-4xl font-semibold leading-tight max-md:text-3xl">World ID is a trust signal, not a loan guarantee.</div>
         <div className="mt-4 text-xl leading-8 text-white/82 max-md:text-lg">
            Verification makes the borrower harder to fake. The credit signal still comes from transparent terms, small USDC loans, and
            repayment behavior over time.
         </div>
         <div className="mt-6 flex flex-row items-end justify-between gap-6 max-md:flex-col max-md:items-start">
            <ul className="flex flex-col gap-3 text-base leading-6 max-md:max-w-full">
               {listData.map((item) => (
                  <li key={item.title} className="flex gap-3">
                     <LockKeyhole className="mt-1 size-4 shrink-0 text-emerald-300" />
                     <span>{item.title}</span>
                  </li>
               ))}
            </ul>
            <div className="flex shrink-0 items-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-zinc-950">
               World ID first
               <ArrowRight className="size-4" />
            </div>
         </div>
      </div>
   );
}
