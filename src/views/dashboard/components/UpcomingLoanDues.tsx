import { AlertTriangle, Clock3 } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { calculateDaysRemaining, formatDate } from '@/utils/dateFormatters';
import { formatCurrency } from '@/utils/decimalHelpers';

import type { RootState } from '@/store/store';
import type { Loan } from '@/types/loanTypes';

interface UpcomingLoanDuesProps {
   activeLoans: Loan[];
   defaultedLoans: Loan[];
}

type DueLoan = Loan & { dueKind: 'defaulted' | 'active' };

function LoanDueCard({ loan }: { loan: DueLoan }) {
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const lenderName = loan.lenderUser ? userProfiles[loan.lenderUser]?.username || 'Unknown lender' : 'Unknown lender';
   const daysRemaining = calculateDaysRemaining(loan.dueDate);
   const isDefaulted = loan.dueKind === 'defaulted';

   return (
      <article className={`min-w-[150px] shrink-0 rounded-md-lg p-md-3 ${isDefaulted ? 'bg-md-red-100' : 'bg-[#fff8e1]'}`}>
         <span
            className={`mb-md-2 flex h-9 w-9 items-center justify-center rounded-full text-white ${isDefaulted ? 'bg-md-red-500' : 'bg-[#c28800]'}`}
         >
            {isDefaulted ? <AlertTriangle className="h-5 w-5" strokeWidth={2.2} /> : <Clock3 className="h-5 w-5" strokeWidth={2.2} />}
         </span>
         <p className="text-md-h5 font-semibold text-md-heading">${formatCurrency(loan.totalRepaymentAmount || loan.loanAmount)}</p>
         <p
            className={`mt-1 inline-flex rounded-md-pill px-md-1 py-[2px] text-md-b4 font-semibold ${isDefaulted ? 'bg-white text-md-red-800' : 'bg-white text-[#8a6d00]'}`}
         >
            {isDefaulted ? 'Default' : daysRemaining > 0 ? `Due in ${daysRemaining}d` : 'Due today'}
         </p>
         <p className="mt-md-2 text-md-b4 text-md-neutral-1200">Lent by {lenderName}</p>
         <p className="mt-1 text-md-b4 text-md-neutral-1200">Due {formatDate(loan.dueDate)}</p>
      </article>
   );
}

export default function UpcomingLoanDues({ activeLoans, defaultedLoans }: UpcomingLoanDuesProps) {
   const defaultedIds = new Set(defaultedLoans.map((loan) => loan.id));
   const dueLoans: DueLoan[] = [...defaultedLoans, ...activeLoans.filter((loan) => !defaultedIds.has(loan.id))]
      .map((loan) => ({ ...loan, dueKind: defaultedIds.has(loan.id) ? 'defaulted' : 'active' }))
      .sort((a, b) => {
         if (a.dueKind !== b.dueKind) return a.dueKind === 'defaulted' ? -1 : 1;
         return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });

   return (
      <section>
         <div className="mb-md-3 flex items-center justify-between">
            <h2 className="text-md-h5 font-semibold text-md-heading">Upcoming Loan Dues</h2>
            <Link className="text-md-b3 font-semibold text-md-blue-600 underline" to="/loan-insights">
               View Insights
            </Link>
         </div>
         {dueLoans.length > 0 ? (
            <div className="-mx-md-4 flex gap-md-3 overflow-x-auto px-md-4 pb-md-1" style={{ scrollbarWidth: 'none' }}>
               {dueLoans.slice(0, 6).map((loan) => (
                  <LoanDueCard key={loan.id} loan={loan} />
               ))}
            </div>
         ) : (
            <div className="rounded-md-lg bg-white p-md-5 text-center shadow-md-card">
               <p className="text-md-b1 font-semibold text-md-heading">No active loan dues</p>
               <p className="mt-1 text-md-b3 text-md-neutral-1200">Funded loans and due dates will show here.</p>
            </div>
         )}
      </section>
   );
}
