import { useState } from 'react';

import { drawLimitSpin } from '@/config/creditTiers';
import LimitSpinWheel from '@/views/dashboard-v2/components/LimitSpinWheel';
import NextLoanCard from '@/views/dashboard-v2/components/NextLoanCard';
import type { DashboardV2Due } from '@/views/dashboard-v2/types';

const DAY = 86_400_000;

const sampleDue = (daysToDue: number, daysSinceFunded: number, principal = 15): DashboardV2Due => {
   const now = Date.now();
   const funded = now - daysSinceFunded * DAY;
   const deadline = now + daysToDue * DAY;
   return {
      id: `sample-${daysToDue}`,
      amount: principal * 1.1,
      daysRemaining: daysToDue,
      deadline: new Date(deadline).toISOString(),
      rewardFrom: new Date(funded + (deadline - funded) / 2).toISOString(),
      fundedAt: new Date(funded).toISOString(),
      principal,
      zone: 'Asia/Manila',
      lenderName: 'a moo-lender',
      isOverdue: false
   };
};

// The real odds (drawLimitSpin), a fresh draw each time, with or without the Shark Chomp +$1.
function SpinPlayground() {
   const [round, setRound] = useState(0);
   const [bonus, setBonus] = useState(false);
   const [limit, setLimit] = useState(15);
   const [draw, setDraw] = useState(() => drawLimitSpin());
   const raise = Math.max(0, Math.min(draw + (bonus ? 1 : 0), 35 - limit));
   const shownBonus = Math.min(bonus ? 1 : 0, raise);
   return (
      <div className="flex flex-col items-center gap-3">
         <LimitSpinWheel key={round} amount={raise - shownBonus} bonus={shownBonus} toLimit={limit + raise} onDone={() => setLimit(limit + raise)} />
         <label className="flex items-center gap-2 text-[14px] font-semibold text-[#45556c]">
            <input checked={bonus} onChange={(e) => setBonus(e.target.checked)} type="checkbox" /> Beat level 3 of Shark Chomp (+$1)
         </label>
         <div className="flex gap-2">
            <button
               className="rounded-full bg-[#6010D2] px-4 py-2 text-[14px] font-bold text-white"
               onClick={() => {
                  setDraw(drawLimitSpin());
                  setRound(round + 1);
               }}
               type="button"
            >
               Next loan: spin again
            </button>
            <button
               className="rounded-full border border-[#6010D2] px-4 py-2 text-[14px] font-bold text-[#6010D2]"
               onClick={() => {
                  setLimit(15);
                  setDraw(drawLimitSpin());
                  setRound(round + 1);
               }}
               type="button"
            >
               Start over at $15
            </button>
         </div>
         <p className="text-[13px] text-[#70617F]">Limit now: ${limit} · top is $35</p>
      </div>
   );
}

const STREAK = { current: 1, best: 1, nextStep: 3, toGo: 2, nextPhp: 50 };

/** Dev only: the "Your next loan" card in each state. ?state=best|early|less|none|ceiling|spin shows one. */
export default function NextLoanPreview() {
   const only = new URLSearchParams(window.location.search).get('state');
   const states: { key: string; label: string; dues: DashboardV2Due[]; ceiling?: boolean; spin?: boolean }[] = [
      { key: 'best', label: 'Best days (2nd half)', dues: [sampleDue(10, 20)] },
      { key: 'early', label: 'Too early (just funded)', dues: [sampleDue(29, 1)] },
      { key: 'less', label: 'Borrowed less than the limit', dues: [sampleDue(20, 10, 10)] },
      { key: 'none', label: 'No loan out', dues: [] },
      { key: 'ceiling', label: 'At their income ceiling ($35)', dues: [], ceiling: true },
      { key: 'spin', label: 'Limit Spin', dues: [], spin: true }
   ];
   return (
      <div className="min-h-screen bg-dv2-page">
         <div className="mx-auto flex max-w-[440px] flex-col gap-6 px-5 py-6">
            {states
               .filter((state) => !only || state.key === only)
               .map((state) => (
                  <section key={state.key} className="rounded-[8px] bg-dv2-card px-2.5 pb-3.5 pt-4">
                     <p className="px-1 text-[13px] font-semibold text-[#45556c]">{state.label}</p>
                     {state.spin ? (
                        <div className="pt-3">
                           <SpinPlayground />
                        </div>
                     ) : state.ceiling ? (
                        <NextLoanCard dues={state.dues} limit={35} nextLimit={35} atCeiling streak={STREAK} />
                     ) : (
                        <NextLoanCard dues={state.dues} limit={15} nextLimit={25} streak={STREAK} />
                     )}
                  </section>
               ))}
         </div>
      </div>
   );
}
