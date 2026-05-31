import { useSelector } from 'react-redux';

import { useIsBorrower } from '@/hooks/useIsBorrower';

import { useLocalization } from '@/i18n';
import type { RootState } from '@/store/store';
import { WorldId } from '@/types/authTypes';

const BADGE_COPY = {
   en: {
      verified: 'Verified Borrower',
      notVerified: 'Not Verified'
   },
   fil: {
      verified: 'Beripikadong humihiram',
      notVerified: 'Hindi verified'
   },
   id: {
      verified: 'Peminjam terverifikasi',
      notVerified: 'Belum terverifikasi'
   }
} as const;

export default function BorrowerVerificationBadge() {
   const isBorrower = useIsBorrower();
   const isWorldId = useSelector((state: RootState) => state.auth.user?.isWorldId);
   const { locale } = useLocalization();
   const copy = BADGE_COPY[locale] ?? BADGE_COPY.en;

   if (!isBorrower) return null;

   const verified = isWorldId === WorldId.ACTIVE;

   if (verified) {
      return (
         <span className="self-start inline-flex items-center gap-1 bg-md-green-100 rounded-md-sm px-md-1 py-md-0">
            <span className="w-3 h-3 rounded-full bg-md-green-900 flex items-center justify-center">
               <span className="text-white text-[8px] font-bold">&#10003;</span>
            </span>
            <span className="text-md-b3 font-semibold text-md-green-900">{copy.verified}</span>
         </span>
      );
   }
   return (
      <span className="self-start inline-flex items-center gap-1 bg-md-red-100 rounded-md-sm px-md-1 py-md-0">
         <span className="w-3 h-3 rounded-full bg-md-red-800 flex items-center justify-center">
            <span className="text-white text-[8px] font-bold">!</span>
         </span>
         <span className="text-md-b3 font-semibold text-md-red-800">{copy.notVerified}</span>
      </span>
   );
}
