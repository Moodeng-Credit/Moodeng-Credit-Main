import { type PointerEvent, type RefObject, useRef, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { MessengerGlyph, messengerSupportLinkProps } from '@/components/support/MessengerChatButton';

interface SuccessModalProps {
   clickOutsideRef: RefObject<HTMLDivElement> | undefined;
   isOpen: boolean;
   onClose: () => void;
}

const BORROWER_GROUP_TELEGRAM_URL = 'https://t.me/jimmymoodengcredit';
const BORROWER_GROUP_FACEBOOK_URL = 'https://www.facebook.com/groups/1593629908540434';
// The two people borrowers deal with on Messenger and on their call, as small 3D avatars.
const TEAM_AVATARS = ['/team/cartoon-emma.png', '/team/cartoon-george.png'];

const GROUP_TILE =
   'flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#E7E0F0] bg-white text-[15px] font-semibold tracking-[-0.02em] text-[#040033] active:scale-[0.98] dark:border-[#3A2F55] dark:bg-[#221A30] dark:text-[#F0EAFF]';

export default function SuccessModal({ clickOutsideRef, isOpen, onClose }: SuccessModalProps) {
   const navigate = useNavigate();
   const dismissStartRef = useRef<number | null>(null);
   const dismissOffsetRef = useRef(0);
   const [dismissOffset, setDismissOffset] = useState(0);
   const helpLink = messengerSupportLinkProps('request_sent');

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
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/20 px-[21px]">
         <section
            ref={clickOutsideRef}
            className="mx-auto w-full max-w-[398px] touch-none rounded-[24px] border border-[#EEE8F5] bg-white shadow-[0_24px_60px_rgba(4,0,51,0.14)] transition-transform duration-150 ease-out dark:border-[#2E2540] dark:bg-[#1A1426]"
            onPointerDown={startDismissGesture}
            onPointerMove={moveDismissGesture}
            onPointerUp={endDismissGesture}
            onPointerCancel={endDismissGesture}
            style={{ transform: `translateY(${dismissOffset}px)` }}
         >
            {/* 2026-11-26: the team (Emma & George, 3D avatars made from their photos) has passed the request on
                to moo-lenders and will get back to them. Mahjid's tone: never "we can't do many loans", never a
                promise it gets funded. The sign-in screen's crisp look. */}
            <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
               <div className="flex -space-x-3" aria-hidden="true">
                  {TEAM_AVATARS.map((src) => (
                     <img
                        key={src}
                        alt=""
                        src={src}
                        className="h-[60px] w-[60px] rounded-full bg-[#F3EEFB] object-cover ring-4 ring-white dark:ring-[#1A1426]"
                     />
                  ))}
               </div>
               <p className="mt-2 text-[13px] font-medium tracking-[-0.01em] text-[#70617F] dark:text-[#A89BB8]">
                  Emma &amp; George · Moodeng team
               </p>
               <h2 className="mt-4 text-[28px] font-bold leading-[1.15] tracking-[-0.04em] text-[#040033] dark:text-[#F0EAFF]">
                  Request sent
               </h2>
               <p className="mt-2 text-[16px] font-semibold leading-[22px] tracking-[-0.02em] text-[#040033] dark:text-[#F0EAFF]">
                  We&apos;ve passed it to our moo-lenders.
               </p>
               <p className="mt-1 text-[15px] leading-[22px] tracking-[-0.01em] text-[#70617F] dark:text-[#A89BB8]">
                  They review every request and may fund it. It can take some time. We&apos;ll get back to you.
               </p>

               <p className="mt-6 self-start text-[13px] font-semibold tracking-[-0.01em] text-[#040033] dark:text-[#F0EAFF]">
                  Meet moo-lenders in our group
               </p>
               <div className="mt-2 grid w-full grid-cols-2 gap-2">
                  <a className={GROUP_TILE} href={BORROWER_GROUP_TELEGRAM_URL} rel="noopener noreferrer" target="_blank">
                     <img alt="" aria-hidden="true" className="h-5 w-5 object-contain" src="/icons/telegram-classic-filled.png" />
                     Telegram
                  </a>
                  <a className={GROUP_TILE} href={BORROWER_GROUP_FACEBOOK_URL} rel="noopener noreferrer" target="_blank">
                     <span
                        aria-hidden="true"
                        className="block h-5 w-5 flex-shrink-0 bg-[#1877f2]"
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
                     Facebook
                  </a>
               </div>

               <button
                  className="mt-5 h-14 w-full rounded-2xl bg-[#6010D2] text-base font-semibold tracking-[-0.02em] text-[#FDFCFD] transition-opacity hover:opacity-95"
                  onClick={goToDashboard}
                  type="button"
               >
                  Go to dashboard
               </button>
               <a
                  {...helpLink}
                  className="mt-4 flex items-center gap-1.5 text-sm font-medium tracking-[-0.02em] text-[#70617F] hover:text-[#6010D2] dark:text-[#A89BB8]"
               >
                  <span className="size-[18px]">
                     <MessengerGlyph />
                  </span>
                  Questions? Message us
               </a>
            </div>
         </section>
      </div>
   );
}
