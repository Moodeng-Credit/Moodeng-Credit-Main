import { useMemo } from 'react';

import { AlertTriangle, Clock3, FileClock } from 'lucide-react';
import { useSelector } from 'react-redux';

import { calculateDaysRemaining, formatDate } from '@/utils/dateFormatters';
import { formatCurrency } from '@/utils/decimalHelpers';

import type { RootState } from '@/store/store';
import type { Loan } from '@/types/loanTypes';
import Calendar from '@/views/profile/components/Calendar';
import { useDashboardData } from '@/views/profile/components/tabs/useDashboardData';

import DashboardHeader from './components/DashboardHeader';

type InsightLoan = Loan & { insightStatus: 'defaulted' | 'active' | 'pending' | 'paid' };

const getInsightStatus = (loan: Loan): InsightLoan['insightStatus'] => {
   if (loan.repaymentStatus === 'Paid') return 'paid';
   if (loan.repaymentStatus === 'Unpaid' && new Date(loan.dueDate).getTime() < Date.now()) return 'defaulted';
   if (loan.loanStatus === 'Requested') return 'pending';
   return 'active';
};

const STATUS_CONFIG: Record<InsightLoan['insightStatus'], { label: string; className: string; icon: typeof Clock3 }> = {
   defaulted: { label: 'Defaulted', className: 'bg-md-red-100 text-md-red-800', icon: AlertTriangle },
   active: { label: 'Active', className: 'bg-[#fff8e1] text-[#8a6d00]', icon: Clock3 },
   pending: { label: 'Pending', className: 'bg-[#eadfff] text-md-primary-900', icon: FileClock },
   paid: { label: 'Paid', className: 'bg-md-green-100 text-md-green-900', icon: Clock3 }
};

function LoanInsightCard({ loan }: { loan: InsightLoan }) {
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const status = STATUS_CONFIG[loan.insightStatus];
   const Icon = status.icon;
   const lenderName = loan.lenderUser ? userProfiles[loan.lenderUser]?.username || 'Unknown lender' : 'No lender yet';
   const daysRemaining = calculateDaysRemaining(loan.dueDate);

   return (
      <article className="rounded-[18px] border border-[#eadfff] bg-white p-md-3 shadow-md-card">
         <div className="mb-md-2 flex items-start justify-between gap-md-3">
            <div className="min-w-0">
               <p className="text-md-b4 font-semibold uppercase text-md-neutral-1200">{loan.trackingId || 'Loan'}</p>
               <p className="mt-1 text-md-h5 font-semibold text-md-heading">
                  ${formatCurrency(loan.totalRepaymentAmount || loan.loanAmount)}
               </p>
            </div>
            <span
               className={`inline-flex shrink-0 items-center gap-1 rounded-md-pill px-md-2 py-1 text-md-b4 font-semibold ${status.className}`}
            >
               <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
               {status.label}
            </span>
         </div>
         <div className="grid grid-cols-2 gap-md-2">
            <div className="rounded-[14px] bg-[#fbf8ff] p-md-2">
               <p className="text-md-b4 font-semibold uppercase text-md-neutral-1200">Lender</p>
               <p className="mt-1 truncate text-md-b2 font-semibold text-md-heading">{lenderName}</p>
            </div>
            <div className="rounded-[14px] bg-[#fbf8ff] p-md-2">
               <p className="text-md-b4 font-semibold uppercase text-md-neutral-1200">Due</p>
               <p className="mt-1 text-md-b2 font-semibold text-md-heading">
                  {loan.insightStatus === 'defaulted'
                     ? `${Math.abs(daysRemaining)}d late`
                     : daysRemaining > 0
                       ? `${daysRemaining}d left`
                       : 'Today'}
               </p>
            </div>
         </div>
         <p className="mt-md-2 text-md-b3 text-md-neutral-1200">Due date: {formatDate(loan.dueDate)}</p>
         {loan.reason ? <p className="mt-1 text-md-b3 text-md-neutral-1200">Reason: {loan.reason}</p> : null}
      </article>
   );
}

export default function LoanInsights() {
   const { loanArrays } = useDashboardData('borrower');
   const loans = useMemo(() => {
      const allLoans = [...loanArrays.defaultedLoans, ...loanArrays.activeLoans, ...loanArrays.pendingLoans, ...loanArrays.repayments];
      const seen = new Set<string>();
      return allLoans
         .filter((loan) => {
            if (seen.has(loan.id)) return false;
            seen.add(loan.id);
            return true;
         })
         .map((loan) => ({ ...loan, insightStatus: getInsightStatus(loan) }))
         .sort((a, b) => {
            const order = { defaulted: 0, active: 1, pending: 2, paid: 3 };
            if (order[a.insightStatus] !== order[b.insightStatus]) return order[a.insightStatus] - order[b.insightStatus];
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
         });
   }, [loanArrays]);

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <main className="mx-auto flex max-w-[440px] flex-col gap-md-5 px-md-4 pb-32 pt-md-3">
            <DashboardHeader title="Loan Insights" />
            <section className="rounded-md-lg bg-white p-md-4 shadow-md-card">
               <h1 className="text-md-h4 font-semibold text-md-heading">Loan calendar</h1>
               <p className="mt-md-1 text-md-b2 text-md-neutral-1200">Active, pending, and defaulted loan dates in one place.</p>
            </section>
            <div className="[&_.rdp-root]:text-md-heading [&_.rdp-root]:text-md-b3 [&>div]:max-w-none [&>div]:rounded-md-lg [&>div]:p-md-4 [&>div]:shadow-md-card">
               <Calendar
                  activeLoans={loanArrays.activeLoans}
                  defaultedLoans={loanArrays.defaultedLoans}
                  pendingLoans={loanArrays.pendingLoans}
               />
            </div>
            <section className="flex flex-col gap-md-3">
               <h2 className="text-md-h5 font-semibold text-md-heading">Loan details</h2>
               {loans.length > 0 ? (
                  loans.map((loan) => <LoanInsightCard key={loan.id} loan={loan} />)
               ) : (
                  <div className="rounded-md-lg bg-white p-md-5 text-center shadow-md-card">
                     <p className="text-md-b1 font-semibold text-md-heading">No loan history yet</p>
                     <p className="mt-1 text-md-b3 text-md-neutral-1200">Loan insights appear after requests or funded loans exist.</p>
                  </div>
               )}
            </section>
         </main>
      </div>
   );
}
