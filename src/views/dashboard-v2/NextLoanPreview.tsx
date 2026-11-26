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

const STREAK = { current: 1, best: 1, nextStep: 3, toGo: 2, nextPhp: 50 };

/** Dev only: the "Your next loan" card in each state. ?state=best|early|less|none shows one. */
export default function NextLoanPreview() {
   const only = new URLSearchParams(window.location.search).get('state');
   const states: { key: string; label: string; dues: DashboardV2Due[] }[] = [
      { key: 'best', label: 'Best days (last week)', dues: [sampleDue(4, 26)] },
      { key: 'early', label: 'Too early (just funded)', dues: [sampleDue(26, 4)] },
      { key: 'less', label: 'Borrowed less than the limit', dues: [sampleDue(20, 10, 10)] },
      { key: 'none', label: 'No loan out', dues: [] }
   ];
   return (
      <div className="min-h-screen bg-dv2-page">
         <div className="mx-auto flex max-w-[440px] flex-col gap-6 px-5 py-6">
            {states
               .filter((state) => !only || state.key === only)
               .map((state) => (
                  <section key={state.key} className="rounded-[8px] bg-dv2-card px-2.5 pb-3.5 pt-4">
                     <p className="px-1 text-[13px] font-semibold text-[#45556c]">{state.label}</p>
                     <NextLoanCard dues={state.dues} limit={15} nextLimit={25} streak={STREAK} />
                  </section>
               ))}
         </div>
      </div>
   );
}
