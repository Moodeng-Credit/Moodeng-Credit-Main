import { Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { calculateLenderDiversity, getDiversityStatus } from '@/utils/diversityScore';

import type { User } from '@/types/authTypes';
import type { Loan } from '@/types/loanTypes';

interface LenderDiversitySectionProps {
   fundedLoans: Loan[];
   userProfiles: Record<string, User>;
}

const STATUS_CLASSES: Record<string, string> = {
   Excellent: 'bg-md-green-100 text-md-green-900 border-[#bfe8cf]',
   Good: 'bg-[#d1e8ff] text-md-blue-800 border-[#a3d1ff]',
   Fair: 'bg-[#fff8e1] text-[#8a6d00] border-[#f5dd83]',
   Low: 'bg-[#ffedd5] text-[#c2410c] border-[#fed7aa]',
   'Very Low': 'bg-md-red-100 text-md-red-800 border-[#fecaca]'
};

export default function LenderDiversitySection({ fundedLoans, userProfiles }: LenderDiversitySectionProps) {
   const diversity = calculateLenderDiversity(fundedLoans, userProfiles);
   const status = getDiversityStatus(diversity.score);
   const statusClass = STATUS_CLASSES[status] ?? STATUS_CLASSES['Very Low'];
   const uniqueLabel = `${diversity.uniqueLenders} Unique ${diversity.uniqueLenders === 1 ? 'Lender' : 'Lenders'}`;

   return (
      <section className="rounded-md-lg bg-white p-md-4 shadow-md-card">
         <div className="mb-md-3 flex items-center justify-between gap-md-2">
            <div className="flex min-w-0 items-center gap-md-1">
               <Users className="h-5 w-5 shrink-0 text-md-primary-900" strokeWidth={2.2} />
               <h2 className="truncate text-md-h5 font-semibold text-md-heading">Lender Diversity Score</h2>
            </div>
            <Link className="shrink-0 text-md-b3 font-semibold text-md-blue-600 underline" to="/lender-diversity">
               {uniqueLabel}
            </Link>
         </div>
         {diversity.hasEnoughHistory ? (
            <>
               <div className="flex items-center justify-between gap-md-3">
                  <div>
                     <p className="text-md-h4 font-semibold text-md-heading">{diversity.score} points</p>
                     <p className="mt-1 text-md-b3 text-md-neutral-1200">
                        Raw {diversity.rawScore} with {Math.round(diversity.confidence * 100)}% confidence.
                     </p>
                  </div>
                  <span className={`rounded-md-pill border px-md-2 py-1 text-md-b4 font-semibold ${statusClass}`}>
                     {diversity.confidence < 1 ? 'Early Score' : status}
                  </span>
               </div>
               <div className="mt-md-3 h-3 overflow-hidden rounded-md-pill bg-md-neutral-300">
                  <div className="h-full rounded-md-pill bg-md-primary-900" style={{ width: `${Math.max(diversity.score, 4)}%` }} />
               </div>
            </>
         ) : (
            <div className="rounded-[16px] border border-[#eadfff] bg-[#fbf8ff] p-md-3">
               <p className="text-md-b1 font-semibold text-md-heading">Not enough history</p>
               <p className="mt-1 text-md-b3 text-md-neutral-1200">
                  A lender diversity score appears after at least 2 funded borrower loans.
               </p>
            </div>
         )}
      </section>
   );
}
