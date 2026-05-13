import { Link } from 'react-router-dom';

import { formatCurrency } from '@/utils/decimalHelpers';
import type { StatsData } from '@/views/profile/components/tabs/types';

interface LoanSummarySectionProps {
   stats: StatsData;
}

const STAT_CARDS = [
   {
      key: 'repayments' as const,
      label: 'Repayments',
      bgColor: 'bg-[#d6f8e6]',
      iconBg: 'bg-[#16884b]',
   },
   {
      key: 'pending' as const,
      label: 'Pending Loans',
      bgColor: 'bg-[#fff6d0]',
      iconBg: 'bg-[#c28800]',
   },
   {
      key: 'defaulted' as const,
      label: 'Defaulted',
      bgColor: 'bg-md-red-100',
      iconBg: 'bg-[#dd0417]',
   },
   {
      key: 'active' as const,
      label: 'Active Loans',
      bgColor: 'bg-[#d1e8ff]',
      iconBg: 'bg-[#0076eb]',
   },
];

export default function LoanSummarySection({ stats }: LoanSummarySectionProps) {
   return (
      <div>
         <div className="flex items-center justify-between mb-3">
            <h2 className="text-md-b1 font-semibold text-md-heading">Loan Summary</h2>
            <Link to="/repay" className="text-md-b3 font-medium text-md-blue-600 underline">
               Pay Loans
            </Link>
         </div>

         <div className="flex gap-3 overflow-x-auto pb-2 -mx-md-4 px-md-4" style={{ scrollbarWidth: 'none' }}>
            {STAT_CARDS.map(({ key, label, bgColor, iconBg }) => {
               const stat = stats[key];
               return (
                  <div
                     key={key}
                     className={`${bgColor} rounded-md-lg p-3.5 min-w-[140px] flex-shrink-0 flex flex-col gap-2`}
                  >
                     <div className={`${iconBg} w-9 h-9 rounded-full flex items-center justify-center`}>
                        <img src="/icons/stats.png" alt="" className="w-4 h-4" />
                     </div>
                     <p className="text-md-h4 font-semibold text-md-heading">{stat.count}</p>
                     <p className="text-md-b3 font-medium text-md-heading">{label}</p>
                     <div>
                        <p className="text-md-b4 text-md-neutral-700">Total</p>
                        <p className="text-md-b2 font-semibold text-md-heading">${formatCurrency(stat.total)}</p>
                     </div>
                  </div>
               );
            })}
         </div>
      </div>
   );
}
