import { useSelector } from 'react-redux';

import { useIsBorrower } from '@/hooks/useIsBorrower';
import type { RootState } from '@/store/store';

const BORROWER_STATS = [
   { label: 'Active Loans', value: '—' },
   { label: 'Total Repaid', value: '—' },
   { label: 'Credit Score (IOU)', value: null },
] as const;

const LENDER_STATS = [
   { label: 'Loans Funded', value: '—' },
   { label: 'Total Lent', value: '—' },
   { label: 'IOU Points', value: null },
] as const;

export default function Dashboard() {
   const user = useSelector((state: RootState) => state.auth.user);
   const isBorrower = useIsBorrower();
   const firstName = user?.username?.split(' ')[0] || 'there';
   const cs = user?.cs?.toLocaleString() ?? '—';

   const stats = isBorrower ? BORROWER_STATS : LENDER_STATS;

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28 flex flex-col gap-5 px-md-4 py-md-3">
            <div className="flex flex-col gap-1">
               <p className="text-md-h3 font-semibold text-md-heading">Hello, {firstName}</p>
               <p className="text-md-b2 text-md-neutral-700">
                  {isBorrower ? 'Your borrower overview.' : 'Your lender overview.'}
               </p>
            </div>

            <div className="flex flex-col gap-3">
               {stats.map(({ label, value }) => (
                  <div
                     key={label}
                     className="bg-md-neutral-100 rounded-md-lg p-4 flex items-center justify-between shadow-md-card"
                  >
                     <span className="text-md-b2 font-medium text-md-neutral-700">{label}</span>
                     <span className="text-md-h5 font-semibold text-md-heading">
                        {value ?? cs}
                     </span>
                  </div>
               ))}
            </div>

            <div className="bg-md-neutral-100 rounded-md-lg p-4 flex items-center justify-center shadow-md-card">
               <p className="text-md-b2 text-md-neutral-1200">Full dashboard coming soon</p>
            </div>
         </div>
      </div>
   );
}
