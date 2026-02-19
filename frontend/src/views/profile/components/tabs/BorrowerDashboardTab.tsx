import { useSelector } from 'react-redux';

import { WorldId } from '@/types/authTypes';
import { CREDIT_TIERS, getEffectiveCreditLimit } from '@/lib/creditLeveling';
import { getMemberSinceText } from '@/utils/dateFormatters';
import { toNumber, formatNumber } from '@/utils/decimalHelpers';
import type { RootState } from '@/store/store';
import { STAT_CARDS_CONFIG } from '@/views/profile/components/tabs/constants';
import MilestoneCard from '@/views/profile/components/tabs/MilestoneCard';
import StatCard from '@/views/profile/components/tabs/StatCard';
import TrustScoreCircle from '@/views/profile/components/tabs/TrustScoreCircle';
import { useDashboardData } from '@/views/profile/components/tabs/useDashboardData';

interface BorrowerDashboardTabProps {
   onPayLoansNow?: () => void;
}

const BorrowerDashboardTab = ({ onPayLoansNow }: BorrowerDashboardTabProps) => {
   const user = useSelector((state: RootState) => state.auth.user);
   const { stats, lenderDiversityScore, loanArrays, trustScore, milestones } = useDashboardData('borrower');

   const isVerified = user.isWorldId === WorldId.ACTIVE;
   const memberSince = user.createdAt ? getMemberSinceText(user.createdAt) : '';

   // Credit level display
   const currentLimit = getEffectiveCreditLimit(user.cs, isVerified);
   const levelIndex = CREDIT_TIERS.indexOf(currentLimit as (typeof CREDIT_TIERS)[number]);
   const levelDisplay = levelIndex >= 0 ? levelIndex : 0;

   const activeLoanAmount = loanArrays.activeLoans.reduce((sum, loan) => sum + toNumber(loan.loanAmount), 0);
   const creditUsed = Math.min(activeLoanAmount, currentLimit);
   const creditUsagePercent = currentLimit > 0 ? Math.min(100, (creditUsed / currentLimit) * 100) : 0;

   const card = 'bg-white rounded-2xl p-6 shadow-sm border border-border/50';

   return (
      <section>
         <div className={card}>
            <div className="flex items-center gap-2 mb-4">
               <h3 className="font-extrabold text-lg text-foreground">Trust Score</h3>
               <button type="button" aria-label="Trust score info" className="w-5 h-5 rounded-full border border-muted-foreground/50 text-muted-foreground text-xs flex items-center justify-center hover:bg-muted/50 transition">
                  <i className="fas fa-question" aria-hidden="true" />
               </button>
            </div>
            <div className="flex justify-center">
               <TrustScoreCircle score={trustScore} />
            </div>
            <p className="text-xs text-muted-foreground text-center mt-4 leading-relaxed max-w-sm mx-auto">
               Your Trust Score grows with every on-time repayment and lives with your wallet.
            </p>

            <div className="mt-8 pt-6 border-t border-border/50">
               <div className="flex flex-wrap items-center gap-3 mb-4">
                  <h3 className="font-extrabold text-lg text-foreground">Credit Level</h3>
                  <button type="button" className="text-xs font-semibold text-[#7c3aed] hover:underline flex items-center gap-1 ml-auto">
                     <i className="fas fa-play-circle" aria-hidden="true" /> Watch guide
                  </button>
               </div>
               <div className="flex items-center justify-between mb-3">
                  <span className="font-extrabold text-base text-foreground">LVL {levelDisplay}</span>
                  <span className="text-sm font-semibold text-[#7c3aed]">${formatNumber(creditUsed)} / ${formatNumber(currentLimit)}</span>
               </div>
               <div className="w-full h-3 rounded-full bg-[#ede9fe] overflow-hidden">
                  <div
                     className="h-3 rounded-full transition-all duration-700"
                     style={{ width: `${creditUsagePercent}%`, background: 'linear-gradient(to right, #7c3aed, #a855f7)' }}
                  />
               </div>
            </div>
         </div>

         {/* Card: Reputation Milestones */}
         <div className={card}>
            <div className="flex items-center justify-between mb-1">
               <h3 className="font-extrabold text-lg text-foreground">Reputation Milestones</h3>
               <button type="button" className="text-xs font-semibold text-[#7c3aed] hover:underline">View All</button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Complete milestones to unlock higher loan levels.</p>
            <div className="space-y-3">
               {milestones.map((m) => (
                  <MilestoneCard key={m.id} milestone={m} />
               ))}
            </div>
         </div>

         {/* ── Get Verified CTA (shown when not verified) ── */}
         {!isVerified && (
            <div className="rounded-2xl p-4 flex items-center gap-4 bg-amber-50 border border-amber-200/60">
               <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground">One quick step to request a loan</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Complete verification to start building trust with lenders.</p>
                  <button type="button" className="mt-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
                     Get Verified
                  </button>
               </div>
               <span className="text-4xl select-none" aria-hidden="true">🦛</span>
            </div>
         )}

         {/* Card: Loan Summary + Lender Diversity + Upcoming Dues */}
         <div className={card}>
            <div className="flex items-center justify-between mb-4">
               <h3 className="font-extrabold text-lg text-foreground">Loan Summary</h3>
               <button type="button" onClick={onPayLoansNow} className="text-xs font-semibold text-[#7c3aed] hover:underline">
                  Pay Loans
               </button>
            </div>
            <div
               className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-1 -mx-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
               {STAT_CARDS_CONFIG.filter((c) => c.key !== 'active').map((config) => (
                  <div key={config.key} className="flex-[0_0_min(45%,280px)] min-w-[min(45%,280px)] snap-center shrink-0">
                     <StatCard config={config} count={stats[config.key].count} total={stats[config.key].total} />
                  </div>
               ))}
            </div>

            <div className="mt-6 pt-6 border-t border-border/50 flex flex-wrap items-center justify-between gap-4">
               <div>
                  <h3 className="font-extrabold text-base text-foreground">Lender Diversity Score</h3>
                  <p className="text-2xl font-extrabold text-foreground mt-0.5">{lenderDiversityScore} points</p>
               </div>
               <button type="button" className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition">
                  Request Loan
               </button>
            </div>

            <div className="mt-6 pt-6 border-t border-border/50">
               <h3 className="font-extrabold text-base text-foreground mb-3">Upcoming Loan Dues</h3>
               {loanArrays.activeLoans.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No upcoming loan dues.</p>
               ) : (
                  <ul className="space-y-2">
                     {loanArrays.activeLoans.slice(0, 3).map((loan) => (
                        <li key={loan.id} className="flex items-center justify-between text-sm">
                           <span className="text-foreground font-medium truncate max-w-[60%]">{loan.reason || 'Loan'}</span>
                           <span className="text-[#7c3aed] font-semibold">${formatNumber(toNumber(loan.loanAmount))}</span>
                        </li>
                     ))}
                  </ul>
               )}
            </div>
         </div>

      </section>
   );
};

export default BorrowerDashboardTab;
