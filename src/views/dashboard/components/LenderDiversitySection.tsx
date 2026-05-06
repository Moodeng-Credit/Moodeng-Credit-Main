import { useMemo } from 'react';

import { Link } from 'react-router-dom';

import { calculateLenderDiversity, getDiversityStatus } from '@/utils/diversityScore';
import type { Loan } from '@/types/loanTypes';

interface LenderDiversitySectionProps {
   score: number;
   fundedLoans: Loan[];
   isVerified: boolean;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border?: string }> = {
   Excellent: { bg: 'bg-md-green-100', text: 'text-md-green-800' },
   Good: { bg: 'bg-[#dbeafe]', text: 'text-md-blue-700' },
   Fair: { bg: 'bg-[rgba(211,170,0,0.05)]', text: 'text-[#d3aa00]', border: 'border border-[#d3aa00]' },
   Low: { bg: 'bg-[#ffedd5]', text: 'text-[#c2410c]' },
   'Very Low': { bg: 'bg-md-red-100', text: 'text-md-red-500' },
};

export default function LenderDiversitySection({ score, fundedLoans, isVerified }: LenderDiversitySectionProps) {
   const { uniqueLenders } = useMemo(() => calculateLenderDiversity(fundedLoans), [fundedLoans]);
   const statusLabel = useMemo(() => getDiversityStatus(score), [score]);
   const style = STATUS_STYLES[statusLabel] ?? STATUS_STYLES['Very Low'];

   const linkLabel = uniqueLenders > 0 ? `${uniqueLenders} Unique Lenders` : '0 Active Lenders';

   return (
      <div className="bg-md-neutral-100 rounded-md-lg p-4 shadow-md-card">
         <div className="flex items-center justify-between mb-3">
            <h2 className="text-md-b1 font-semibold text-md-heading">Lender Diversity Score</h2>
            <Link to="/lender-diversity" className="text-md-b3 font-medium text-md-blue-600 underline">
               {linkLabel}
            </Link>
         </div>

         <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
               <p className="text-md-h5 font-semibold text-md-heading">{score} points</p>
               {score > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-md-b4 font-medium ${style.bg} ${style.text} ${style.border ?? ''}`}>
                     {statusLabel}
                  </span>
               )}
            </div>
            <Link
               to={isVerified ? '/repay' : '/verify-world-id'}
               className="inline-flex items-center px-4 py-2 rounded-md-md bg-md-primary-1200 text-white text-md-b3 font-semibold"
            >
               {isVerified ? 'Pay Loans' : 'Request Loan'}
            </Link>
         </div>
      </div>
   );
}
