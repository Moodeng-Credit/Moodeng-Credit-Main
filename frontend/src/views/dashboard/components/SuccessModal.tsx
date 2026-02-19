import { type RefObject } from 'react';
import { Link } from 'react-router-dom';

interface SuccessModalProps {
   clickOutsideRef: RefObject<HTMLDivElement> | undefined;
   isOpen: boolean;
   onClose: () => void;
}

export default function SuccessModal({ clickOutsideRef, isOpen, onClose }: SuccessModalProps) {
   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
         <section
            ref={clickOutsideRef}
            className="relative bg-background rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-border"
         >
            <button
               onClick={onClose}
               className="absolute top-4 right-4 z-10 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
               aria-label="Close"
            >
               <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
               </svg>
            </button>
            <div className="flex flex-col items-center pt-8 pb-8 px-6 text-center">
               <img
                  src="/loan_request_subitted.png"
                  alt=""
                  className="w-full max-w-[240px] h-auto object-contain mb-6"
               />
               <h1 className="text-xl font-semibold text-foreground mb-2">Loan request submitted</h1>
               <p className="text-sm text-muted-foreground mb-6">
                  Your loan request is now live. Lenders can review it and fund your request.
               </p>
               <Link to="/dashboard" onClick={onClose}>
                  <button
                     type="button"
                     className="w-full min-w-[200px] rounded-lg bg-[#6d57ff] hover:bg-[#5b46e0] text-white font-medium py-2.5 px-4 transition-colors"
                  >
                     Go to dashboard
                  </button>
               </Link>
            </div>
         </section>
      </div>
   );
}
