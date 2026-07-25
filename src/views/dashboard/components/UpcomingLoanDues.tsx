import { useMemo } from 'react';

import { useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';

import UserAvatar from '@/components/UserAvatar';
import { calculateDaysRemaining } from '@/utils/dateFormatters';
import { formatCurrency } from '@/utils/decimalHelpers';

import { useLocalization } from '@/i18n';
import type { RootState } from '@/store/store';
import type { Loan } from '@/types/loanTypes';

interface UpcomingLoanDuesProps {
   activeLoans: Loan[];
   defaultedLoans: Loan[];
   username?: string;
}

function LoanDueCard({ loan }: { loan: Loan & { isDefaulted: boolean } }) {
   const { locale } = useLocalization();
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const copy =
      locale === 'fil'
         ? {
              unknown: 'Hindi kilala',
              lenderAlt: 'Nagpahiram',
              default: 'Hindi nabayaran',
              dueIn: 'Kailangang bayaran sa loob ng',
              today: 'ngayong araw',
              dayLabel: (days: number) => `${days} araw`,
              lentBy: 'Pinahiram ni'
           }
         : locale === 'id'
           ? {
                unknown: 'Tidak diketahui',
                lenderAlt: 'Pemberi pinjaman',
                default: 'Gagal bayar',
                dueIn: 'Jatuh tempo dalam',
                today: 'hari ini',
                dayLabel: (days: number) => `${days} hari`,
                lentBy: 'Dipinjamkan oleh'
             }
           : {
                unknown: 'Unknown',
                lenderAlt: 'Lender',
                default: 'Default',
                dueIn: 'Due in',
                today: 'today',
                dayLabel: (days: number) => `${days} ${days === 1 ? 'day' : 'days'}`,
                lentBy: 'Lent by'
             };
   const lenderName = loan.lenderUser ? (userProfiles[loan.lenderUser]?.username ?? copy.unknown) : copy.unknown;
   const daysRemaining = calculateDaysRemaining(loan.dueDate);
   const cardBg = loan.isDefaulted ? 'bg-md-red-100' : 'bg-[#fff6d0] dark:bg-[#3d2d12]';

   return (
      <div className={`${cardBg} rounded-md-lg p-3.5 min-w-[150px] flex-shrink-0 flex flex-col gap-2`}>
         <UserAvatar userId={loan.lenderUser ?? undefined} alt={copy.lenderAlt} size={32} clickable={false} />

         <p className="text-md-h5 font-semibold text-md-heading">${formatCurrency(loan.loanAmount)}</p>
         {loan.isDefaulted ? (
            <span className="inline-flex self-start items-center px-2 py-0.5 rounded-full bg-md-red-100 text-md-red-500 text-md-b4 font-medium">
               {copy.default}
            </span>
         ) : (
            <p className="text-md-b3 text-md-neutral-1500">
               {copy.dueIn}{' '}
               <span className="text-[#896f00] dark:text-[#facc6b] font-semibold">{daysRemaining > 0 ? copy.dayLabel(daysRemaining) : copy.today}</span>
            </p>
         )}
         <p className="text-md-b4 text-md-neutral-700">
            {copy.lentBy} {lenderName}
         </p>
      </div>
   );
}

export default function UpcomingLoanDues({ activeLoans, defaultedLoans, username }: UpcomingLoanDuesProps) {
   const [searchParams] = useSearchParams();
   const { locale } = useLocalization();
   const copy =
      locale === 'fil'
         ? { title: 'Mga paparating na bayarin', insights: 'Tingnan ang detalye', none: 'Walang aktibong pautang' }
         : locale === 'id'
           ? { title: 'Pinjaman yang akan jatuh tempo', insights: 'Lihat detail', none: 'Tidak ada pinjaman aktif' }
           : { title: 'Upcoming Loan Dues', insights: 'View Insights', none: 'No Active Loans' };
   const upcomingLoans = useMemo(() => {
      const defaultedSet = new Set(defaultedLoans.map((l) => l.id));
      const all = [...activeLoans, ...defaultedLoans]
         .filter((loan, i, arr) => arr.findIndex((l) => l.id === loan.id) === i)
         .map((loan) => ({
            ...loan,
            isDefaulted: defaultedSet.has(loan.id)
         }))
         .sort((a, b) => {
            if (a.isDefaulted && !b.isDefaulted) return -1;
            if (!a.isDefaulted && b.isDefaulted) return 1;
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
         });
      return all;
   }, [activeLoans, defaultedLoans]);
   const isMockRich = import.meta.env.DEV && searchParams.get('mockData') === 'rich';
   const insightsHref = username ? `/user/${encodeURIComponent(username)}${isMockRich ? '?demo=rich' : ''}#loan-summary` : '/dashboard';

   return (
      <div>
         <div className="flex items-center justify-between mb-3">
            <h2 className="text-md-b1 font-semibold text-md-heading">{copy.title}</h2>
            <Link to={insightsHref} className="text-md-b3 font-medium text-md-blue-600 underline">
               {copy.insights}
            </Link>
         </div>

         {upcomingLoans.length === 0 ? (
            <div className="bg-md-neutral-100 rounded-md-lg p-8 shadow-md-card flex items-center justify-center">
               <p className="text-md-b2 text-md-neutral-700">{copy.none}</p>
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
