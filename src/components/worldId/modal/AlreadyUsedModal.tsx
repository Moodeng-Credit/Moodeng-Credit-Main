import { type FC } from 'react';

import { ModalButton } from '@/components/worldId/modal/ModalButton';
import { ModalOverlay } from '@/components/worldId/modal/ModalOverlay';

interface AlreadyUsedModalProps {
   isOpen: boolean;
   onClose: () => void;
}

export const AlreadyUsedModal: FC<AlreadyUsedModalProps> = ({ isOpen, onClose }) => {
   return (
      <ModalOverlay isOpen={isOpen} onClose={onClose} ariaLabelledBy="already-used-title" ariaDescribedBy="already-used-desc">
         <div className="overflow-hidden rounded-md-xl bg-white shadow-2xl font-sans">
            {/* Header bar */}
            <div className="flex items-center justify-between border-b border-md-neutral-300 px-4 py-3 sm:px-6 sm:py-4">
               <h3 className="text-md-h5 font-semibold text-md-heading tracking-tight">World ID Verification</h3>
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
                     <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
               </div>

               {/* Title */}
               <h2 id="already-used-title" className="text-md-h5 font-semibold text-md-heading tracking-tight sm:text-md-h4">
                  World ID Already Linked
               </h2>

               {/* Message */}
               <p id="already-used-desc" className="text-md-b2 font-medium leading-relaxed text-md-neutral-1000 sm:text-md-b1">
                  We do not allow duplicate accounts. This World ID is already connected to an existing Moodeng account.
               </p>

               {/* CTA */}
               <div className="w-full pt-1">
                  <ModalButton onClick={onClose}>Got it</ModalButton>
               </div>
            </div>
         </div>
      </ModalOverlay>
   );
};
