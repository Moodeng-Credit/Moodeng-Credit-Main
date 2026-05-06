import { type PointerEvent, type RefObject, useRef, useState } from 'react';

import { useNavigate } from 'react-router-dom';

interface SuccessModalProps {
   clickOutsideRef: RefObject<HTMLDivElement> | undefined;
   isOpen: boolean;
   onClose: () => void;
}

export default function SuccessModal({ clickOutsideRef, isOpen, onClose }: SuccessModalProps) {
   const navigate = useNavigate();
   const dismissStartRef = useRef<number | null>(null);
   const dismissOffsetRef = useRef(0);
   const [dismissOffset, setDismissOffset] = useState(0);

   if (!isOpen) return null;

   const goToDashboard = () => {
      onClose();
      navigate('/dashboard');
   };

   const startDismissGesture = (event: PointerEvent<HTMLElement>) => {
      dismissStartRef.current = event.clientY;
      dismissOffsetRef.current = 0;
      event.currentTarget.setPointerCapture(event.pointerId);
   };

   const moveDismissGesture = (event: PointerEvent<HTMLElement>) => {
      if (dismissStartRef.current === null) return;

      const nextOffset = Math.max(0, event.clientY - dismissStartRef.current);
      dismissOffsetRef.current = nextOffset;
      setDismissOffset(nextOffset);
   };

   const endDismissGesture = (event: PointerEvent<HTMLElement>) => {
      if (dismissStartRef.current === null) return;

      event.currentTarget.releasePointerCapture(event.pointerId);
      const shouldClose = dismissOffsetRef.current > 88;

      dismissStartRef.current = null;
      dismissOffsetRef.current = 0;
      setDismissOffset(0);

      if (shouldClose) onClose();
   };

   return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/20 px-[21px]">
         <section
            ref={clickOutsideRef}
            className="mx-auto w-full max-w-[398px] touch-none rounded-md-lg border border-md-neutral-400 bg-md-neutral-100 shadow-md-card transition-transform duration-150 ease-out"
            onPointerDown={startDismissGesture}
            onPointerMove={moveDismissGesture}
            onPointerUp={endDismissGesture}
            onPointerCancel={endDismissGesture}
            style={{ transform: `translateY(${dismissOffset}px)` }}
         >
            <div className="flex flex-col items-center justify-center gap-5 px-6 py-12 text-center">
               <img alt="" aria-hidden="true" className="h-[124px] w-[124px] object-contain" src="/confirm-image.png" />
               <h2 className="w-full text-md-h3 font-semibold text-md-heading">Loan request submitted</h2>
               <p className="w-full text-md-b1 font-medium text-md-neutral-700">
                  Your loan request is now live. Lenders can review it and fund your request.
               </p>
               <button
                  className="w-full rounded-md-lg bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100"
                  onClick={goToDashboard}
                  type="button"
               >
                  Go to dashboard
               </button>
            </div>
         </section>
      </div>
   );
}
