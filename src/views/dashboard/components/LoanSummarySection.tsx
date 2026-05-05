import { AlertTriangle, CheckCircle2, Clock3, Files } from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatCurrency } from '@/utils/decimalHelpers';

import type { StatsData } from '@/views/profile/components/tabs/types';

interface LoanSummarySectionProps {
   stats: StatsData;
}

const SUMMARY_CARDS = [
   {
      key: 'repayments' as const,
      label: 'Repayments',
      icon: CheckCircle2,
      bg: 'bg-md-green-100',
      iconBg: 'bg-md-green-800',
      text: 'text-md-green-900'
   },
   {
      key: 'pending' as const,
      label: 'Pending Loans',
      icon: Clock3,
      bg: 'bg-[#fff8e1]',
      iconBg: 'bg-[#c28800]',
      text: 'text-[#8a6d00]'
   },
   {
      key: 'defaulted' as const,
      label: 'Defaulted',
      icon: AlertTriangle,
      bg: 'bg-md-red-100',
      iconBg: 'bg-md-red-500',
      text: 'text-md-red-800'
   },
   {
      key: 'active' as const,
      label: 'Active Loans',
      icon: Files,
      bg: 'bg-[#d1e8ff]',
      iconBg: 'bg-md-blue-600',
      text: 'text-md-blue-800'
   }
];

export default function LoanSummarySection({ stats }: LoanSummarySectionProps) {
   return (
      <section>
         <div className="mb-md-3 flex items-center justify-between">
            <h2 className="text-md-h5 font-semibold text-md-heading">Loan Summary</h2>
            <Link className="text-md-b3 font-semibold text-md-blue-600 underline" to="/repay">
               Pay Loans
            </Link>
         </div>
         <div className="-mx-md-4 flex gap-md-3 overflow-x-auto px-md-4 pb-md-1" style={{ scrollbarWidth: 'none' }}>
            {SUMMARY_CARDS.map((card) => {
               const Icon = card.icon;
               const stat = stats[card.key];
               return (
                  <article key={card.key} className={`${card.bg} flex min-h-[186px] min-w-[170px] shrink-0 flex-col rounded-md-lg p-md-3`}>
                     <span className={`mb-md-1 flex h-10 w-10 items-center justify-center rounded-full text-white ${card.iconBg}`}>
                        <Icon className="h-5 w-5" strokeWidth={2.2} />
                     </span>
                     <p className={`text-md-h3 font-semibold ${card.text}`}>{stat.count}</p>
                     <p className="mt-1 text-md-b1 font-semibold text-md-heading">{card.label}</p>
                     <div className="mt-auto">
                        <p className="text-md-b3 text-md-neutral-1200">Total</p>
                        <p className="text-md-b2 font-semibold text-md-heading">${formatCurrency(stat.total)}</p>
                     </div>
                  </article>
               );
            })}
         </div>
      </section>
   );
}
