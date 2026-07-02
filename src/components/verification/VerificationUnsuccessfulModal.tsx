import { type FC } from 'react';

import { ModalOverlay } from '@/components/worldId/modal/ModalOverlay';

import type { VerifyMethod } from '@/lib/verifyFlow';
import {
   SUPPORT_FACEBOOK_URL,
   TELEGRAM_SUPPORT_URL,
   WORLD_ID_VERIFICATION_SUPPORT_URL
} from '@/views/support/constants';

interface VerificationUnsuccessfulModalProps {
   isOpen: boolean;
   method: VerifyMethod;
   onClose: () => void;
}

/**
 * Shown on the request board when a user started a verification (World ID or the
 * traditional ID/KYC check) but returned without completing it — e.g. the check
 * was declined, or the World App handoff dropped them back here. Purely
 * reassuring + a route to human support; it never changes verification state.
 */
export const VerificationUnsuccessfulModal: FC<VerificationUnsuccessfulModalProps> = ({ isOpen, method, onClose }) => {
   const isWorldIdMethod = method === 'worldid' || method === 'worldid-passport';
   const methodLabel = isWorldIdMethod ? 'World ID' : 'your ID';
   const telegramUrl = isWorldIdMethod ? WORLD_ID_VERIFICATION_SUPPORT_URL : TELEGRAM_SUPPORT_URL;

   return (
      <ModalOverlay
         isOpen={isOpen}
         onClose={onClose}
         ariaLabelledBy="verify-unsuccessful-title"
         ariaDescribedBy="verify-unsuccessful-desc"
      >
         <div className="overflow-hidden rounded-md-xl bg-white shadow-2xl font-sans">
            {/* Header bar */}
            <div className="flex items-center justify-between border-b border-md-neutral-300 px-4 py-3 sm:px-6 sm:py-4">
               <h3 className="text-md-h5 font-semibold text-md-heading tracking-tight">Verification</h3>
               <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-md-neutral-1000 transition-colors hover:bg-md-neutral-300 active:scale-95"
                  aria-label="Close"
               >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                     <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
               </button>
            </div>

            {/* Body */}
            <div className="flex flex-col items-center gap-4 px-5 pb-6 pt-6 text-center sm:gap-5 sm:px-6 sm:pb-8 sm:pt-7">
               {/* Icon */}
               <div className="flex h-14 w-14 items-center justify-center rounded-full bg-md-red-100 sm:h-16 sm:w-16">
                  <svg
                     className="h-7 w-7 text-md-red-300 sm:h-8 sm:w-8"
                     fill="none"
                     viewBox="0 0 24 24"
                     stroke="currentColor"
                     strokeWidth={2.5}
                  >
                     <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008M10.34 3.94l-8.4 14.55A1.5 1.5 0 003.24 21h17.52a1.5 1.5 0 001.3-2.51L13.66 3.94a1.5 1.5 0 00-2.6 0z" />
                  </svg>
               </div>

               {/* Title */}
               <h2
                  id="verify-unsuccessful-title"
                  className="text-md-h5 font-semibold text-md-heading tracking-tight sm:text-md-h4"
               >
                  We couldn&rsquo;t verify you
               </h2>

               {/* Message */}
               <p
                  id="verify-unsuccessful-desc"
                  className="text-md-b2 font-medium leading-relaxed text-md-neutral-1000 sm:text-md-b1"
               >
                  We&rsquo;re sorry &mdash; we weren&rsquo;t able to verify you with {methodLabel}. You can try again anytime.
                  If you need help, our team is here for you.
               </p>

               {/* Support CTAs */}
               <div className="flex w-full flex-col gap-3 pt-1">
                  <a
                     href={telegramUrl}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="flex w-full items-center justify-center rounded-md-lg bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100 transition-colors hover:opacity-90 active:scale-[0.99]"
                  >
                     Contact support on Telegram
                  </a>
                  <a
                     href={SUPPORT_FACEBOOK_URL}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="flex w-full items-center justify-center rounded-md-lg border border-md-neutral-300 px-md-4 py-md-3 text-md-b1 font-semibold text-md-heading transition-colors hover:bg-md-neutral-200 active:scale-[0.99]"
                  >
                     Contact support on Facebook
                  </a>
                  <button
                     type="button"
                     onClick={onClose}
                     className="pt-1 text-md-b2 font-medium text-md-neutral-700 underline underline-offset-2"
                  >
                     Dismiss
                  </button>
               </div>
            </div>
         </div>
      </ModalOverlay>
   );
};
