
import { useMemo, useState } from 'react';

import { useSelector } from 'react-redux';

import { useClickOutside } from '@/hooks/useClickOutside';

import type { RootState } from '@/store/store';

import Calendar from '@/views/profile/components/Calendar';
import { STAT_CARDS_CONFIG } from '@/views/profile/components/tabs/constants';
import CreditLevelCard from '@/views/profile/components/tabs/CreditLevelCard';
import ReputationMilestones from '@/views/profile/components/tabs/ReputationMilestones';
import RoleToggle from '@/views/profile/components/tabs/RoleToggle';
import StatCard from '@/views/profile/components/tabs/StatCard';
import TrustScoreHelpModal from '@/views/profile/components/tabs/TrustScoreHelpModal';
import TrustScoreWidget from '@/views/profile/components/tabs/TrustScoreWidget';
import type { RoleType } from '@/views/profile/components/tabs/types';
import { useDashboardData } from '@/views/profile/components/tabs/useDashboardData';
import UserProfileHeader from '@/views/profile/components/tabs/UserProfileHeader';

interface DashboardTabProps {
   onPayLoansNow?: () => void;
}

const DashboardTab = ({ onPayLoansNow }: DashboardTabProps) => {
   const [activeRole, setActiveRole] = useState<RoleType>('borrower');
   const [showTrustScoreHelp, setShowTrustScoreHelp] = useState(false);
   const user = useSelector((state: RootState) => state.auth.user);
   const { stats, lenderDiversityScore, creditLevels, loanArrays, trustScoreData } = useDashboardData(activeRole);

   const trustScoreHelpRef = useClickOutside<HTMLDivElement>(
      () => setShowTrustScoreHelp(false),
      showTrustScoreHelp
   );

   // Calculate current credit level (memoized to avoid filtering on every render)
   const currentCreditLevel = useMemo(() => creditLevels.filter((l) => l.unlocked).length - 1, [creditLevels]);

   return (
      <section className="flex-1 overflow-auto p-6 space-y-6">
         {/* User Profile Header - Only show for borrower role */}
         {activeRole === 'borrower' && <UserProfileHeader user={user} />}

         {/* Trust Score and Credit Level Summary - Only for borrower */}
         {activeRole === 'borrower' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <TrustScoreWidget trustScoreData={trustScoreData} onHelpClick={() => setShowTrustScoreHelp(true)} />

               {/* Current Credit Level Summary */}
               <div className="bg-white rounded-xl p-6 space-y-4">
                  <h2 className="font-extrabold text-xl select-none">Credit Level</h2>
                  <div className="space-y-3">
                     <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-gray-900">LVL {currentCreditLevel}</span>
                        <span className="text-lg text-gray-600">/ {creditLevels.length - 1}</span>
                     </div>
                     <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                           <span className="text-gray-600">Credit Limit</span>
                           <span className="font-semibold text-gray-900">
                              ${stats.active.total.toFixed(2)} / ${user.cs || 0}
                           </span>
                        </div>
                        <div className="w-full h-3 rounded-full bg-gray-200 overflow-hidden">
                           <div
                              className="h-3 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-300"
                              style={{
                                 width: `${user.cs ? Math.min((stats.active.total / user.cs) * 100, 100) : 0}%`
                              }}
                           />
                        </div>
                     </div>
                     <button className="text-sm text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1">
                        <i className="fa-solid fa-play" />
                        Watch our credit levelling guide
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* Reputation Milestones - Only for borrower */}
         {activeRole === 'borrower' && (
            <ReputationMilestones
               loans={loanArrays.repayments.concat(loanArrays.activeLoans)}
            />
         )}

         <div className="flex flex-col lg:flex-row gap-6">
            <div className="bg-white rounded-xl p-6 flex-1 max-w-full lg:max-w-[720px] space-y-6">
               <div className="flex justify-between items-center">
                  <h2 className="font-extrabold text-xl select-none">Loan Summary</h2>
                  <RoleToggle activeRole={activeRole} onRoleChange={setActiveRole} />
               </div>

               <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex-1 max-w-[280px] min-w-[200px]">
                     <div className="font-bold text-xs text-[#374151] select-none mb-2">Lender Diversity Score</div>
                     <div className="flex items-center space-x-3">
                        <div className="w-full h-5 rounded-md bg-[#d1d5db] overflow-hidden">
                           <div
                              className="h-5 rounded-md transition-all duration-300"
                              style={{
                                 width: `${lenderDiversityScore}%`,
                                 background: 'linear-gradient(to right, #a3d977, #4caf50)'
                              }}
                           />
                        </div>
                        <span className="text-sm select-none whitespace-nowrap font-medium">{lenderDiversityScore} Points</span>
                     </div>
                  </div>
                  <button
                     className="bg-[#2563eb] text-white px-6 py-3 rounded-md font-semibold select-none hover:bg-[#1e40af] transition"
                     onClick={onPayLoansNow}
                     type="button"
                  >
                     PAY LOANS NOW
                  </button>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {STAT_CARDS_CONFIG.map((config) => (
                     <StatCard key={config.key} config={config} count={stats[config.key].count} total={stats[config.key].total} />
                  ))}
               </div>
            </div>

            <Calendar
               activeLoans={loanArrays.activeLoans}
               defaultedLoans={loanArrays.defaultedLoans}
               pendingLoans={loanArrays.pendingLoans}
            />
         </div>

         {/* Credit Level Section */}
         <div className="bg-white rounded-xl p-6 flex flex-col overflow-x-auto select-none gap-4">
            <h2 className="font-extrabold text-xl flex items-center gap-2">
               Credit Level
               <button
                  aria-label="Info"
                  className="text-[#374151] text-sm rounded-full border border-[#374151] w-6 h-6 flex items-center justify-center hover:bg-gray-50 transition"
                  type="button"
               >
                  <i className="fa-solid fa-circle-info" />
               </button>
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
               {creditLevels.map((level) => (
                  <CreditLevelCard key={level.id} level={level} />
               ))}
            </div>
         </div>

         {/* Trust Score Help Modal */}
         <TrustScoreHelpModal
            isOpen={showTrustScoreHelp}
            onClose={() => setShowTrustScoreHelp(false)}
            clickOutsideRef={trustScoreHelpRef}
         />
      </section>
   );
};

export default DashboardTab;
