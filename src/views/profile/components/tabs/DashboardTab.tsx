'use client';

import { useState } from 'react';

import Calendar from '@/views/profile/components/Calendar';
import { STAT_CARDS_CONFIG } from '@/views/profile/components/tabs/constants';
import CreditLevelCard from '@/views/profile/components/tabs/CreditLevelCard';
import RoleToggle from '@/views/profile/components/tabs/RoleToggle';
import StatCard from '@/views/profile/components/tabs/StatCard';
import type { RoleType } from '@/views/profile/components/tabs/types';
import { useDashboardData } from '@/views/profile/components/tabs/useDashboardData';

const DashboardTab = () => {
   const [activeRole, setActiveRole] = useState<RoleType>('borrower');
   const { stats, lenderDiversityScore, creditLevels, loanArrays } = useDashboardData(activeRole);

   return (
      <section className="flex-1 overflow-auto p-6 space-y-6">
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
                  <button className="bg-[#2563eb] text-white px-6 py-3 rounded-md font-semibold select-none hover:bg-[#1e40af] transition">
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
      </section>
   );
};

export default DashboardTab;
