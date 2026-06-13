import { useCallback, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import WorldIDVerification from '@/components/worldId/WorldIDVerification';

type VerifyYourselfModalProps = {
   isOpen: boolean;
   onClose: () => void;
   /** Optional in-app destination to send the user to after they verify. */
   returnTo?: string;
   /** Optional extra callback fired when the World ID path succeeds, before navigation. */
   onWorldIdSuccess?: () => void;
};

/**
 * Lets a user pick how to verify their identity: World ID (Orb) or traditional
 * KYC (Didit ID + selfie). Both paths grant the same verified status.
 */
export default function VerifyYourselfModal({ isOpen, onClose, returnTo, onWorldIdSuccess }: VerifyYourselfModalProps) {
   const navigate = useNavigate();

   const navigateAfterVerified = useCallback(() => {
      switch (returnTo) {
         case 'loan-request':
            navigate('/request-board', { state: { openLoanRequest: true } });
            return;
         case 'account-settings':
            navigate('/account/settings');
            return;
         case 'repay':
            navigate('/repay');
            return;
         case 'milestones':
            navigate('/milestones');
            return;
         case 'dashboard-credit-level':
            navigate('/dashboard');
            return;
         default:
            // Stay in place; being verified updates the surrounding UI reactively.
            return;
      }
   }, [navigate, returnTo]);

   const handleWorldIdSuccess = useCallback(() => {
      onWorldIdSuccess?.();
      onClose();
      navigateAfterVerified();
   }, [onClose, navigateAfterVerified, onWorldIdSuccess]);

   const goToTraditionalKyc = useCallback(() => {
      onClose();
      navigate('/verify-didit', { state: returnTo ? { returnTo } : undefined });
   }, [navigate, onClose, returnTo]);

   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#12071f]/50 px-5" onClick={onClose}>
         <div
            className="bg-white rounded-md-lg p-md-4 w-full max-w-modal flex flex-col gap-md-4 items-center"
            onClick={(e) => e.stopPropagation()}
         >
            <div className="flex flex-col gap-2 items-center text-center">
               <h2 className="text-md-h4 font-semibold text-md-heading">Verify Yourself</h2>
               <p className="text-md-b1 text-md-neutral-1200">
                  Choose how you&rsquo;d like to verify your identity. You only need to complete one.
               </p>
            </div>

            <div className="flex flex-col gap-md-2 w-full">
               <WorldIDVerification onSuccess={handleWorldIdSuccess} className="w-full">
                  {({ open }) => (
                     <button
                        type="button"
                        onClick={open}
                        className="w-full py-md-3 px-md-4 bg-md-primary-1200 rounded-md-lg flex flex-col items-center gap-0.5 text-md-neutral-100"
                     >
                        <span className="text-md-b1 font-semibold">World ID (Orb)</span>
                        <span className="text-md-b3 font-medium opacity-90">Fast, privacy-preserving proof you&rsquo;re human</span>
                     </button>
                  )}
               </WorldIDVerification>

               <button
                  type="button"
                  onClick={goToTraditionalKyc}
                  className="w-full py-md-3 px-md-4 border border-md-primary-1200 rounded-md-lg flex flex-col items-center gap-0.5 text-md-primary-1200"
               >
                  <span className="text-md-b1 font-semibold">Traditional KYC</span>
                  <span className="text-md-b3 font-medium opacity-90">Quick ID &amp; selfie check</span>
               </button>
            </div>

            <button
               type="button"
               onClick={onClose}
               className="text-md-b2 font-medium text-md-neutral-700 underline underline-offset-2"
            >
               Cancel
            </button>
         </div>
      </div>
   );
}

/**
 * Convenience hook for triggering the verification chooser from any bespoke
 * button. Render `modal` somewhere in your tree and call `open` from your button.
 */
export function useVerifyYourself(returnTo?: string, onWorldIdSuccess?: () => void) {
   const [isOpen, setIsOpen] = useState(false);
   const open = useCallback(() => setIsOpen(true), []);
   const close = useCallback(() => setIsOpen(false), []);
   const modal = <VerifyYourselfModal isOpen={isOpen} onClose={close} returnTo={returnTo} onWorldIdSuccess={onWorldIdSuccess} />;
   return { open, close, isOpen, modal };
}
