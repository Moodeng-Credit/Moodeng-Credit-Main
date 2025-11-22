'use client';

import { useState } from 'react';

import Calendar from '@/views/profile/components/Calendar';

export default function DashboardTab() {
   const [activeRole, setActiveRole] = useState<'borrower' | 'lender'>('borrower');

   return (
      <section className="flex-1 overflow-auto p-6 space-y-6">
         <div className="flex flex-col lg:flex-row gap-6">
            {/* Loan Summary Section */}
            <div className="bg-white rounded-xl p-6 flex-1 max-w-full lg:max-w-[720px] space-y-6">
               <div className="flex justify-between items-center">
                  <h2 className="font-extrabold text-xl select-none">Loan Summary</h2>
                  <div className="flex rounded-md overflow-hidden text-sm font-extrabold select-none">
                     <button
                        onClick={() => setActiveRole('borrower')}
                        className={`px-6 py-2 rounded-tl-md rounded-bl-md transition ${
                           activeRole === 'borrower' ? 'bg-[#2563eb] text-white' : 'bg-white text-[#2563eb]'
                        }`}
                        type="button"
                     >
                        Borrower
                     </button>
                     <button
                        onClick={() => setActiveRole('lender')}
                        className={`px-6 py-2 rounded-tr-md rounded-br-md transition ${
                           activeRole === 'lender' ? 'bg-[#b9c6f9] text-white' : 'bg-white text-[#2563eb]'
                        }`}
                        type="button"
                     >
                        Lender
                     </button>
                  </div>
               </div>

               {/* Lender Diversity Score & Pay Loans Button */}
               <div className="flex items-center justify-between">
                  <div className="flex-1 max-w-[280px]">
                     <div className="font-bold text-xs text-[#374151] select-none mb-2">Lender Diversity Score</div>
                     <div className="flex items-center space-x-3">
                        <div className="w-full h-5 rounded-md bg-[#d1d5db] overflow-hidden">
                           <div
                              className="h-5 rounded-md w-4/5"
                              style={{ background: 'linear-gradient(to right, #a3d977, #4caf50)' }}
                           />
                        </div>
                        <span className="text-sm select-none whitespace-nowrap">80 Points</span>
                     </div>
                  </div>
                  <button className="bg-[#2563eb] text-white px-6 py-3 rounded-md font-semibold select-none" type="button">
                     PAY LOANS NOW
                  </button>
               </div>

               {/* Loan Stats Cards */}
               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                  {/* Repayments Card */}
                  <div className="bg-[#d9f6d9] rounded-xl p-5 select-none">
                     <div className="flex items-center space-x-3 mb-3">
                        <div className="bg-[#34c759] text-white rounded-full p-2 text-xs">
                           <i className="fas fa-chart-bar" />
                        </div>
                        <div className="font-extrabold text-lg text-[#111827]">41</div>
                     </div>
                     <div className="text-sm font-semibold text-[#111827] mb-1">Repayments</div>
                     <div className="text-xs font-bold text-[#34c759] mb-1">Total</div>
                     <div className="font-extrabold text-lg text-[#111827]">$47,100.00</div>
                  </div>

                  {/* Active Loans Card */}
                  <div className="bg-[#fff1d6] rounded-xl p-5 select-none">
                     <div className="flex items-center space-x-3 mb-3">
                        <div className="bg-[#ff9b86] text-white rounded-full p-2 text-xs">
                           <i className="fas fa-file-alt" />
                        </div>
                        <div className="font-extrabold text-lg text-[#111827]">12</div>
                     </div>
                     <div className="text-sm font-semibold text-[#111827] mb-1">Active Loans</div>
                     <div className="text-xs font-bold text-[#ff9b86] mb-1">Total</div>
                     <div className="font-extrabold text-lg text-[#111827]">$300.00</div>
                  </div>

                  {/* Defaulted Card */}
                  <div className="bg-[#ffe1e1] rounded-xl p-5 select-none">
                     <div className="flex items-center space-x-3 mb-3">
                        <div className="bg-[#ff5a75] text-white rounded-full p-2 text-xs">
                           <i className="fas fa-tag" />
                        </div>
                        <div className="font-extrabold text-lg text-[#111827]">1</div>
                     </div>
                     <div className="text-sm font-semibold text-[#111827] mb-1">Defaulted</div>
                     <div className="text-xs font-bold text-[#ff5a75] mb-1">Total</div>
                     <div className="font-extrabold text-lg text-[#111827]">$3.00</div>
                  </div>

                  {/* Pending Loans Card */}
                  <div className="bg-[#ede0ff] rounded-xl p-5 select-none">
                     <div className="flex items-center space-x-3 mb-3">
                        <div className="bg-[#b18aff] text-white rounded-full p-2 text-xs">
                           <i className="fas fa-user-friends" />
                        </div>
                        <div className="font-extrabold text-lg text-[#111827]">8</div>
                     </div>
                     <div className="text-sm font-semibold text-[#111827] mb-1">Pending Loans</div>
                     <div className="text-xs font-bold text-[#b18aff] mb-1">Total</div>
                     <div className="font-extrabold text-lg text-[#111827]">$15.00</div>
                  </div>
               </div>
            </div>

            {/* Loan Insights Calendar */}
            <Calendar />
         </div>

         {/* Credit Level Section */}
         <div
            className="bg-white rounded-xl p-6 flex flex-col overflow-x-auto select-none gap-4"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
         >
            <h2 className="font-extrabold text-xl flex-shrink-0 mb-6 sm:mb-0 sm:mr-6 flex items-center gap-2 whitespace-nowrap">
               Credit Level
               <button
                  aria-label="Info"
                  className="text-[#374151] text-sm rounded-full border border-[#374151] w-6 h-6 flex items-center justify-center"
               >
                  <i className="fa-solid fa-circle-info" />
               </button>
            </h2>
            <div className="flex gap-4 no-scrollbar overflow-x-auto">
               {/* Credit Card 1 */}
               <div className="bg-[#e0e7ff] rounded-xl p-4 min-w-[140px] text-center text-[#2563eb] text-xs font-semibold">
                  <div>
                     Credit Unlocked
                     <br />
                     on March 02 2025
                  </div>
                  <div className="text-3xl font-extrabold mt-3 mb-1">
                     $60
                     <span className="text-lg">+</span>
                  </div>
                  <div className="flex items-center justify-center gap-1 font-extrabold mb-1">
                     <i className="fas fa-crown" />
                     <span>Lender_4000</span>
                  </div>
                  <div className="text-xs text-black font-normal mb-3">Helped you with</div>
                  <div className="text-xs text-black font-extrabold mb-3">
                     Need to buy
                     <br />
                     Books for School
                  </div>
                  <div className="text-xs text-black font-normal">3 DAYS TO REPAY</div>
               </div>

               {/* Credit Card 2 */}
               <div className="bg-[#e0e7ff] rounded-xl p-4 min-w-[140px] text-center text-[#2563eb] text-xs font-semibold">
                  <div>
                     Credit Unlocked
                     <br />
                     on March 02 2025
                  </div>
                  <div className="text-3xl font-extrabold mt-3 mb-1">
                     $80
                     <span className="text-lg">+</span>
                  </div>
                  <div className="flex items-center justify-center gap-1 font-extrabold mb-1">
                     <i className="fas fa-crown" />
                     <span>Lender Name</span>
                  </div>
                  <div className="text-xs text-black font-normal mb-3">Helped you with</div>
                  <div className="text-xs text-black font-extrabold mb-3">
                     Unexpected car repair,
                     <br />
                     waiting for reimbursement
                  </div>
                  <div className="text-xs text-black font-normal">1 WEEK TO REPAY</div>
               </div>

               {/* Max Credit Card */}
               <div className="bg-[#2563eb] rounded-xl p-6 min-w-[220px] text-center text-white text-xs font-semibold relative">
                  <div>Unlocked on March 01 2025</div>
                  <div className="text-5xl font-extrabold mt-6 mb-2">
                     $100
                     <span className="text-2xl">+</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 font-extrabold mb-2 text-white">
                     <i className="fas fa-trophy text-3xl" />
                     <div className="text-2xl text-left">
                        Max Credit
                        <br />
                        <span className="font-normal">Unlocked!</span>
                     </div>
                  </div>
                  <div className="text-xs font-normal">Repay a $100 Loan to Unlock Next Level</div>
               </div>

               {/* Locked Card 1 */}
               <div className="bg-[#e5e7eb] rounded-xl p-6 min-w-[140px] text-center text-[#6b7280] text-lg font-extrabold relative">
                  <i className="fas fa-lock absolute top-4 left-1/2 -translate-x-1/2 text-3xl" />
                  <div className="mt-12">$120</div>
                  <div>LOCKED</div>
                  <div className="text-sm font-normal mt-2">
                     Repay a $100 Loan
                     <br />
                     to Unlock this Level
                  </div>
                  <button className="bg-[#6b7280] text-white text-sm rounded-md px-4 py-3 mt-4 font-normal select-none" type="button">
                     Request Loan
                  </button>
               </div>

               {/* Locked Card 2 */}
               <div className="bg-[#e5e7eb] rounded-xl p-6 min-w-[140px] text-center text-[#6b7280] text-lg font-extrabold relative">
                  <i className="fas fa-lock absolute top-4 left-1/2 -translate-x-1/2 text-3xl" />
                  <div className="mt-12">$140</div>
                  <div>LOCKED</div>
                  <div className="text-sm font-normal mt-2">
                     Repay a $120 Loan
                     <br />
                     to Unlock this Level
                  </div>
               </div>
            </div>
         </div>
      </section>
   );
}
