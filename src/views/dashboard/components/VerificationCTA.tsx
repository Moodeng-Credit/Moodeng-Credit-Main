import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { useVerifyYourself } from '@/components/verification/VerifyYourselfModal';
import { isVerificationPending } from '@/lib/isUserVerified';
import type { RootState } from '@/store';

export default function VerificationCTA() {
   const navigate = useNavigate();
   const user = useSelector((state: RootState) => state.auth.user);
   const isPending = isVerificationPending(user);
   const { open, modal } = useVerifyYourself('loan-request');

   // Differentiate the pending copy by the actual Didit status the webhook recorded.
   const rawStatus = user?.diditIdStatus?.toLowerCase() ?? '';
   const pendingTitle = rawStatus.includes('review') ? 'Manual review in progress' : 'Verification in progress';
   const pendingBody = rawStatus.includes('review')
      ? 'A human reviewer is double-checking your documents — this can take up to 1 business day.'
      : rawStatus === 'abandoned' || rawStatus === 'expired'
        ? "Your last verification wasn't finished. Tap below to start over."
        : "Your documents are being reviewed. We'll notify you once confirmed.";

   return (
      <div className="bg-md-yellow-100 rounded-md-lg p-4 flex gap-3 items-center shadow-md-card">
         <div className="flex-1">
            <p className="text-md-heading text-md-b2 font-semibold mb-1">
               {isPending ? pendingTitle : 'One quick step to request a loan'}
            </p>
            <p className="text-md-neutral-700 text-md-b4 mb-3">
               {isPending ? pendingBody : 'Complete a one-time verification to start building trust with lenders.'}
            </p>
            <button
               type="button"
               onClick={isPending ? () => navigate('/verify') : open}
               className="inline-flex items-center px-4 py-2 rounded-md-md bg-md-primary-900 text-white text-md-b3 font-semibold"
            >
               {isPending ? 'View status →' : 'Verify Yourself'}
            </button>
         </div>
         <img src="/hippos/welcome.png" alt="Moodeng" className="w-20 h-20 object-contain shrink-0" />
         {!isPending && modal}
      </div>
   );
}
