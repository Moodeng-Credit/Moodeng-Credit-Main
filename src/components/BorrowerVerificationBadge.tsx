import { useSelector } from 'react-redux';

import { useIsBorrower } from '@/hooks/useIsBorrower';

import { useLocalization } from '@/i18n';
import { getVerificationUiState } from '@/lib/verificationUiState';
import type { RootState } from '@/store/store';

const BADGE_COPY = {
   en: {
      verified: 'Verified Borrower',
      notVerified: 'Not Verified',
      pending: 'Pending',
      review: 'In review',
      unfinished: 'Unfinished'
   },
   fil: {
      verified: 'Beripikadong humihiram',
      notVerified: 'Hindi verified',
      pending: 'Pending',
      review: 'Nire-review',
      unfinished: 'Hindi tapos'
   },
   id: {
      verified: 'Peminjam terverifikasi',
      notVerified: 'Belum terverifikasi',
      pending: 'Menunggu',
      review: 'Sedang ditinjau',
      unfinished: 'Belum selesai'
   }
} as const;

export default function BorrowerVerificationBadge() {
   const isBorrower = useIsBorrower();
   const uiState = useSelector((state: RootState) => getVerificationUiState(state.auth.user));
   const { locale } = useLocalization();
   const copy = BADGE_COPY[locale] ?? BADGE_COPY.en;

   if (!isBorrower) return null;

   if (uiState === 'verified') {
      return (
         <span className="self-start inline-flex items-center gap-1 bg-md-green-100 rounded-md-sm px-md-1 py-md-0">
            <span className="w-3 h-3 rounded-full bg-md-green-900 flex items-center justify-center">
               <span className="text-white text-[8px] font-bold">&#10003;</span>
            </span>
            <span className="text-md-b3 font-semibold text-md-green-900">{copy.verified}</span>
         </span>
      );
   }

   // In-flight states: same amber "hourglass" treatment as the request board so the
   // dashboard never contradicts it ("Not Verified" vs "Pending").
   if (uiState === 'processing' || uiState === 'review' || uiState === 'unfinished') {
      const label = uiState === 'processing' ? copy.pending : uiState === 'review' ? copy.review : copy.unfinished;
      return (
         <span className="self-start inline-flex items-center gap-1 bg-md-primary-100 rounded-md-sm px-md-1 py-md-0">
            <span className="w-3 h-3 rounded-full bg-md-primary-1200 flex items-center justify-center">
               <span className="text-white text-[8px] font-bold">&#8987;</span>
            </span>
            <span className="text-md-b3 font-semibold text-md-primary-1200">{label}</span>
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
