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

   return (
      <section className="flex-1 overflow-auto p-6 space-y-6 max-w-2xl mx-auto w-full">

         {/* ── User header ── */}
         <div className="bg-white rounded-2xl p-5 flex items-start gap-4 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-[#ede9fe] flex items-center justify-center text-[#7c3aed] text-2xl font-extrabold flex-shrink-0 select-none">
               {user.username ? user.username.charAt(0).toUpperCase() : '?'}
            </div>
            <div className="flex-1 min-w-0">
               <h2 className="text-xl font-extrabold text-[#111827]">
                  Hello, {user.username || 'there'}
               </h2>
               <div className="flex flex-wrap items-center gap-2 mt-1">
                  {isVerified ? (
                     <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#16a34a] bg-[#dcfce7] px-2 py-0.5 rounded-full">
                        <i className="fas fa-check-circle" aria-hidden="true" /> Verified
                     </span>
                  ) : (
                     <>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#dc2626] bg-[#fee2e2] px-2 py-0.5 rounded-full">
                           <i className="fas fa-times-circle" aria-hidden="true" /> Not Verified
                        </span>
                        <button
                           type="button"
                           className="text-xs font-semibold text-[#7c3aed] hover:underline"
                        >
                           Verify World ID &gt;
                        </button>
                     </>
                  )}
               </div>
               {memberSince ? (
                  <p className="text-xs text-[#6b7280] mt-1">Member since {memberSince}</p>
               ) : null}
            </div>
         </div>

         {/* ── Trust Score ── */}
         <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
               <h3 className="font-extrabold text-lg text-[#111827]">Trust Score</h3>
               <button
                  type="button"
                  aria-label="Trust score info"
                  className="w-5 h-5 rounded-full border border-[#6b7280] text-[#6b7280] text-xs flex items-center justify-center hover:bg-gray-50 transition"
               >
                  <i className="fas fa-question" aria-hidden="true" />
               </button>
            </div>

            <div className="flex justify-center">
               <TrustScoreCircle score={trustScore} />
            </div>

            <p className="text-xs text-[#6b7280] text-center mt-3 leading-relaxed">
               Your Trust Score grows with every on-time repayment and lives with your wallet.
            </p>
         </div>

         {/* ── Credit Level ── */}
         <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 mb-4">
               <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-lg text-[#111827]">Credit Level</h3>
                  <button
                     type="button"
                     aria-label="Credit level info"
                     className="w-5 h-5 rounded-full border border-[#6b7280] text-[#6b7280] text-xs flex items-center justify-center hover:bg-gray-50 transition"
                  >
                     <i className="fas fa-question" aria-hidden="true" />
                  </button>
               </div>
               <button
                  type="button"
                  className="text-xs font-semibold text-[#7c3aed] hover:underline flex items-center gap-1 ml-auto"
               >
                  <i className="fas fa-play-circle" aria-hidden="true" /> Watch our credit levelling guide
               </button>
            </div>

            <div className="flex items-center justify-between mb-3">
               <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#6b7280] flex items-center justify-center flex-shrink-0" />
                  <span className="font-extrabold text-base text-[#111827]">LVL {levelDisplay}</span>
               </div>
               <span className="text-sm font-semibold text-[#7c3aed]">
                  ${formatNumber(creditUsed)} / ${formatNumber(currentLimit)}
               </span>
            </div>

            <div className="w-full h-3 rounded-full bg-[#ede9fe] overflow-hidden">
               <div
                  className="h-3 rounded-full transition-all duration-700"
                  style={{
                     width: `${creditUsagePercent}%`,
                     background: 'linear-gradient(to right, #7c3aed, #a855f7)'
                  }}
               />
            </div>
         </div>

         {/* ── Reputation Milestones ── */}
         <div>
            <div className="flex items-center justify-between mb-1">
               <h3 className="font-extrabold text-lg text-[#111827]">Reputation Milestones</h3>
               <button type="button" className="text-xs font-semibold text-[#7c3aed] hover:underline">
                  View All Milestones
               </button>
            </div>
            <p className="text-xs text-[#6b7280] mb-3">Complete milestones to unlock higher loan levels.</p>
            <div className="space-y-3">
               {milestones.map((m) => (
                  <MilestoneCard key={m.id} milestone={m} />
               ))}
            </div>
         </div>

         {/* ── Get Verified CTA (shown when not verified) ── */}
         {!isVerified && (
            <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: '#fef9c3' }}>
               <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-[#111827]">One quick step to request a loan</p>
                  <p className="text-xs text-[#6b7280] mt-1">Complete a one-time verification to start building trust with lenders.</p>
                  <button
                     type="button"
                     className="mt-3 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
                  >
                     Get Verified
                  </button>
               </div>
               <div className="text-5xl select-none flex-shrink-0" aria-hidden="true">🦛</div>
            </div>
         )}

         {/* ── Loan Summary ── */}
         <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
               <h3 className="font-extrabold text-lg text-[#111827]">Loan Summary</h3>
               <button
                  type="button"
                  onClick={onPayLoansNow}
                  className="text-xs font-semibold text-[#7c3aed] hover:underline"
               >
                  Pay Loans
               </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
               {STAT_CARDS_CONFIG.filter((c) => c.key !== 'active').map((config) => (
                  <StatCard key={config.key} config={config} count={stats[config.key].count} total={stats[config.key].total} />
               ))}
            </div>
         </div>

         {/* ── Lender Diversity Score ── */}
         <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
               <h3 className="font-extrabold text-base text-[#111827]">Lender Diversity Score</h3>
               <button
                  type="button"
                  className="text-xs font-semibold text-[#7c3aed] hover:underline"
               >
                  {new Set(loanArrays.activeLoans.map((l) => l.lenderUser).filter(Boolean)).size} Active Lenders
               </button>
            </div>
            <div className="text-2xl font-extrabold text-[#111827] mb-3">{lenderDiversityScore} points</div>
            <button
               type="button"
               className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
            >
               Request Loan
            </button>
         </div>

         {/* ── Upcoming Loan Dues ── */}
         <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
               <h3 className="font-extrabold text-lg text-[#111827]">Upcoming Loan Dues</h3>
               <button type="button" className="text-xs font-semibold text-[#7c3aed] hover:underline">
                  View Insights
               </button>
            </div>
            {loanArrays.activeLoans.length === 0 ? (
               <p className="text-xs text-[#6b7280]">No upcoming loan dues.</p>
            ) : (
               <ul className="space-y-2">
                  {loanArrays.activeLoans.slice(0, 3).map((loan) => (
                     <li key={loan.id} className="flex items-center justify-between text-sm">
                        <span className="text-[#374151] font-medium truncate max-w-[60%]">{loan.reason || 'Loan'}</span>
                        <span className="text-[#7c3aed] font-semibold">${formatNumber(toNumber(loan.loanAmount))}</span>
                     </li>
                  ))}
               </ul>
            )}
         </div>

      </section>
   );
};

export default BorrowerDashboardTab;
