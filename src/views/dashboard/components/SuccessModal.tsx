import { type PointerEvent, type RefObject, useRef, useState } from 'react';

import { useNavigate } from 'react-router-dom';

interface SuccessModalProps {
   clickOutsideRef: RefObject<HTMLDivElement> | undefined;
   isOpen: boolean;
   onClose: () => void;
}

const BORROWER_GROUP_TELEGRAM_URL = 'https://t.me/jimmymoodengcredit';
const BORROWER_GROUP_FACEBOOK_URL = 'https://www.facebook.com/groups/1593629908540434';

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
      // Don't start the swipe-to-dismiss gesture (which captures the pointer) when the
      // press begins on an interactive element. Capturing the pointer on the section
      // re-targets the follow-up click away from the button, swallowing its onClick.
      if (event.target instanceof HTMLElement && event.target.closest('button, a, input, textarea, select')) {
         return;
      }

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
               <div className="flex w-full flex-col gap-3 rounded-md-lg border border-md-neutral-400 bg-md-neutral-200 p-4 text-left">
                  <p className="text-md-b2 font-medium text-md-neutral-700">
                     Join the Moodeng borrower group on Facebook or Telegram so we can introduce you to great lenders.
                  </p>
                  <div className="flex flex-col gap-2">
                     <a
                        className="flex items-center gap-3 rounded-md-lg border border-md-neutral-400 bg-md-neutral-100 px-md-4 py-md-3 text-md-b1 font-semibold text-md-heading"
                        href={BORROWER_GROUP_TELEGRAM_URL}
                        rel="noopener noreferrer"
                        target="_blank"
                     >
                        <img alt="" aria-hidden="true" className="h-6 w-6 object-contain" src="/icons/telegram-classic-filled.png" />
                        Join on Telegram
                     </a>
                     <a
                        className="flex items-center gap-3 rounded-md-lg border border-md-neutral-400 bg-md-neutral-100 px-md-4 py-md-3 text-md-b1 font-semibold text-md-heading"
                        href={BORROWER_GROUP_FACEBOOK_URL}
                        rel="noopener noreferrer"
                        target="_blank"
                     >
                        <span
                           aria-hidden="true"
                           className="block h-6 w-6 flex-shrink-0 bg-[#1877f2]"
                           style={{
                              WebkitMaskImage: "url('/icons/facebook.svg')",
                              maskImage: "url('/icons/facebook.svg')",
                              WebkitMaskSize: 'contain',
                              maskSize: 'contain',
                              WebkitMaskRepeat: 'no-repeat',
                              maskRepeat: 'no-repeat',
                              WebkitMaskPosition: 'center',
                              maskPosition: 'center'
                           }}
                        />
                        Join on Facebook
                     </a>
                  </div>
               </div>
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
