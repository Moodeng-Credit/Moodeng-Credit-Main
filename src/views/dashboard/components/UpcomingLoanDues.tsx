import { useMemo } from 'react';

import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { calculateDaysRemaining } from '@/utils/dateFormatters';
import { formatCurrency } from '@/utils/decimalHelpers';
import type { RootState } from '@/store/store';
import type { Loan } from '@/types/loanTypes';

interface UpcomingLoanDuesProps {
   activeLoans: Loan[];
   defaultedLoans: Loan[];
}

function LoanDueCard({ loan }: { loan: Loan & { isDefaulted: boolean } }) {
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const lenderName = loan.lenderUser ? userProfiles[loan.lenderUser]?.username ?? 'Unknown' : 'Unknown';
   const daysRemaining = calculateDaysRemaining(loan.dueDate);
   const cardBg = loan.isDefaulted ? 'bg-md-red-100' : 'bg-[#fff6d0]';

   return (
      <div className={`${cardBg} rounded-md-lg p-3.5 min-w-[150px] flex-shrink-0 flex flex-col gap-2`}>
         <div className="w-8 h-8 rounded-full bg-md-neutral-400 overflow-hidden">
            <img src="/icons/avatar-placeholder.png" alt="Lender" className="w-full h-full object-cover" />
         </div>
         <p className="text-md-h5 font-semibold text-md-heading">${formatCurrency(loan.loanAmount)}</p>
         {loan.isDefaulted ? (
            <span className="inline-flex self-start items-center px-2 py-0.5 rounded-full bg-md-red-100 text-md-red-500 text-md-b4 font-medium">
               Default
            </span>
         ) : (
            <p className="text-md-b3 text-md-neutral-1500">
               Due in <span className="text-[#896f00] font-semibold">{daysRemaining > 0 ? `${daysRemaining} days` : 'today'}</span>
            </p>
         )}
         <p className="text-md-b4 text-md-neutral-700">Lent by {lenderName}</p>
      </div>
   );
}

export default function UpcomingLoanDues({ activeLoans, defaultedLoans }: UpcomingLoanDuesProps) {
   const upcomingLoans = useMemo(() => {
      const defaultedSet = new Set(defaultedLoans.map((l) => l.id));
      const all = [...activeLoans, ...defaultedLoans]
         .filter((loan, i, arr) => arr.findIndex((l) => l.id === loan.id) === i)
         .map((loan) => ({
            ...loan,
            isDefaulted: defaultedSet.has(loan.id),
         }))
         .sort((a, b) => {
            if (a.isDefaulted && !b.isDefaulted) return -1;
            if (!a.isDefaulted && b.isDefaulted) return 1;
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
         });
      return all;
   }, [activeLoans, defaultedLoans]);

   return (
      <div>
         <div className="flex items-center justify-between mb-3">
            <h2 className="text-md-b1 font-semibold text-md-heading">Upcoming Loan Dues</h2>
            <Link to="/lender-diversity" className="text-md-b3 font-medium text-md-blue-600 underline">
               View Insights
            </Link>
         </div>

         {upcomingLoans.length === 0 ? (
            <div className="bg-md-neutral-100 rounded-md-lg p-8 shadow-md-card flex items-center justify-center">
               <p className="text-md-b2 text-md-neutral-700">No Active Loans</p>
            </div>
         ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-md-4 px-md-4" style={{ scrollbarWidth: 'none' }}>
               {upcomingLoans.map((loan) => (
                  <LoanDueCard key={loan.id} loan={loan} />
               ))}
            </div>
         )}
      </div>
   );
}
