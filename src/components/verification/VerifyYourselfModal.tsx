import { useCallback, useState } from 'react';

import { useNavigate } from 'react-router-dom';

type VerifyMethod = 'worldid' | 'didit';

type VerifyYourselfModalProps = {
   isOpen: boolean;
   onClose: () => void;
   /**
    * Where to send the user once verified. A known key (e.g. 'loan-request') maps to a
    * specific screen; any other value is treated as a path to return to. Defaults to the
    * caller's current path.
    */
   returnTo?: string;
};

/**
 * Lets a user pick how to verify their identity: World ID (Orb) or traditional KYC
 * (Didit ID + selfie). Both paths first run a shared liveness check, so both buttons hand
 * off to the /verify orchestrator with the chosen method. Both paths grant verified status.
 */
export default function VerifyYourselfModal({ isOpen, onClose, returnTo }: VerifyYourselfModalProps) {
   const navigate = useNavigate();

   const start = useCallback(
      (method: VerifyMethod) => {
         onClose();
         navigate('/verify', { state: { method, returnTo } });
      },
      [navigate, onClose, returnTo]
   );

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
               <button
                  type="button"
                  onClick={() => start('worldid')}
                  className="w-full py-md-3 px-md-4 bg-md-primary-1200 rounded-md-lg flex flex-col items-center gap-0.5 text-md-neutral-100"
               >
                  <span className="text-md-b1 font-semibold">World ID (Orb)</span>
                  <span className="text-md-b3 font-medium opacity-90">Fast, privacy-preserving proof you&rsquo;re human</span>
               </button>

               <button
                  type="button"
                  onClick={() => start('didit')}
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
 * Convenience hook for triggering the verification chooser from any bespoke button. Render
 * `modal` somewhere in your tree and call `open` from your button.
 *
 * `returnTo` defaults to the caller's current path so the user lands back where they started.
 */
export function useVerifyYourself(returnTo?: string) {
   const [isOpen, setIsOpen] = useState(false);
   const open = useCallback(() => setIsOpen(true), []);
   const close = useCallback(() => setIsOpen(false), []);
   const effectiveReturnTo = returnTo ?? (typeof window !== 'undefined' ? window.location.pathname : undefined);
   const modal = <VerifyYourselfModal isOpen={isOpen} onClose={close} returnTo={effectiveReturnTo} />;
   return { open, close, isOpen, modal };
}
