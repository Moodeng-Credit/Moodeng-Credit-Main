import { useMemo } from 'react';

import { Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import WorldIDVerification from '@/components/worldId/WorldIDVerification';
import { calculateLenderDiversity, getDiversityStatus } from '@/utils/diversityScore';
import type { WalletLivenessData } from '@/utils/diversityScore';

import type { User } from '@/types/authTypes';
import type { Loan } from '@/types/loanTypes';

interface LenderDiversitySectionProps {
   fundedLoans: Loan[];
   isVerified: boolean;
   username?: string;
   userProfiles?: Record<string, User>;
   walletData?: Record<string, WalletLivenessData>;
   detailSearch?: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border?: string }> = {
   Excellent: { bg: 'bg-md-green-100', text: 'text-md-green-800' },
   Good: { bg: 'bg-[#dbeafe]', text: 'text-md-blue-700' },
   Fair: { bg: 'bg-[rgba(211,170,0,0.05)]', text: 'text-[#d3aa00] dark:text-[#facc6b]', border: 'border border-[#d3aa00]' },
   Low: { bg: 'bg-[#ffedd5]', text: 'text-[#c2410c] dark:text-[#fb923c]' },
   'Very Low': { bg: 'bg-md-red-100', text: 'text-md-red-500' }
};

export default function LenderDiversitySection({
   fundedLoans,
   isVerified,
   username,
   userProfiles,
   walletData,
   detailSearch = ''
}: LenderDiversitySectionProps) {
   const lenderDiversity = useMemo(
      () => calculateLenderDiversity(fundedLoans, userProfiles, walletData),
      [fundedLoans, userProfiles, walletData]
   );
   const statusLabel = useMemo(() => getDiversityStatus(lenderDiversity.score), [lenderDiversity.score]);
   const style = STATUS_STYLES[statusLabel] ?? STATUS_STYLES['Very Low'];
   const hasEnoughHistory = lenderDiversity.hasEnoughHistory;
   const isEarlyScore = hasEnoughHistory && lenderDiversity.confidence < 1;

   const linkLabel = `${lenderDiversity.uniqueLenders} Unique ${lenderDiversity.uniqueLenders === 1 ? 'Lender' : 'Lenders'}`;
   const diversityHref = username ? `/user/${encodeURIComponent(username)}/lender-diversity${detailSearch}` : '/dashboard';

   return (
      <div className="relative overflow-hidden rounded-md-lg bg-md-neutral-100 p-4 shadow-md-card">
         <div className="absolute bottom-0 right-0 h-[128px] w-[128px] rounded-tl-[72px] bg-gradient-to-br from-[#f5f3ff] via-[#ede9fe] to-[#f8f5ff] dark:from-[#1f1435] dark:via-[#2a1740] dark:to-[#1f1435]" />
         <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
               <h2 className="mb-2 text-md-b1 font-semibold text-md-heading">Lender Diversity Score</h2>

               {hasEnoughHistory ? (
                  <>
                     <div className="mb-3 flex flex-wrap items-center gap-2">
                        <p className="text-md-h4 font-semibold leading-none text-md-primary-900">{lenderDiversity.score} points</p>
                        <span className={`rounded-full px-2 py-0.5 text-md-b4 font-medium ${style.bg} ${style.text} ${style.border ?? ''}`}>
                           {isEarlyScore ? 'Early Score' : statusLabel}
                        </span>
                     </div>
                     {isEarlyScore ? (
                        <p className="mb-3 max-w-[220px] text-md-b3 leading-5 text-md-neutral-1400">
                           Early estimate: needs 8 funded loans before the score is fully weighted.
                        </p>
                     ) : null}
                  </>
               ) : (
                  <div className="mb-3 max-w-[220px]">
                     <p className="mb-2 text-md-b1 font-semibold text-md-heading">Not enough history</p>
                     <p className="text-md-b3 leading-5 text-md-neutral-1400">This score appears after at least 2 funded loans.</p>
                  </div>
               )}

               <Link to={diversityHref} className="inline-flex items-center gap-2 text-md-b3 font-semibold text-md-blue-600">
                  <Users className="h-4 w-4" strokeWidth={2.4} />
                  <span className="underline">{linkLabel}</span>
               </Link>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-3">
               <img src="/hippos/lender-diversity-piechart.png" alt="" className="h-[96px] w-[96px] object-contain drop-shadow-md" />
               {isVerified ? (
                  <Link to="/repay" className="inline-flex items-center rounded-md-md bg-md-primary-1200 px-3 py-2 text-md-b3 font-semibold text-white">
                     Pay Loans
                  </Link>
               ) : (
                  <WorldIDVerification>
                     {({ open }) => (
                        <button
                           type="button"
                           onClick={open}
                           className="inline-flex items-center rounded-md-md bg-md-primary-1200 px-3 py-2 text-md-b3 font-semibold text-white"
                        >
                           Get Verified
                        </button>
                     )}
                  </WorldIDVerification>
               )}
            </div>
         </div>
      </div>
   );
}
