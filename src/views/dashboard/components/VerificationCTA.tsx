import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { useVerifyYourself } from '@/components/verification/VerifyYourselfModal';
import { isVerificationPending } from '@/lib/isUserVerified';
import { getVerificationUiState, VERIFICATION_STATE_CTA } from '@/lib/verificationUiState';
import type { RootState } from '@/store';

export default function VerificationCTA() {
   const navigate = useNavigate();
   const user = useSelector((state: RootState) => state.auth.user);
   const isPending = isVerificationPending(user);
   const { open, modal } = useVerifyYourself('loan-request');

   // Differentiate the pending copy by the shared verification state model.
   const uiState = getVerificationUiState(user);
   const pendingTitle =
      uiState === 'review'
         ? 'Manual review in progress'
         : uiState === 'unfinished'
           ? 'Verification not finished'
           : uiState === 'declined'
             ? "Verification didn't pass"
             : 'Verification in progress';
   const pendingBody =
      uiState === 'review'
         ? 'A human reviewer is double-checking your documents — this can take up to 1 business day.'
         : uiState === 'unfinished'
           ? 'You left before finishing all the steps. Tap below to continue or start over.'
           : uiState === 'declined'
             ? 'Didit could not verify your identity. Tap below to try again or contact us.'
             : "Your documents are being reviewed. We'll notify you once confirmed.";
   const pendingCta = `${VERIFICATION_STATE_CTA[uiState]} →`;

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
               {isPending ? pendingCta : 'Verify Yourself'}
            </button>
         </div>
         <img src="/hippos/welcome.png" alt="Moodeng" className="w-20 h-20 object-contain shrink-0" />
         {!isPending && modal}
      </div>
   );
}
