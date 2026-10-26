import { useCallback, useEffect, useState } from 'react';

import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import { getVerificationUiState } from '@/lib/verificationUiState';
import type { RootState } from '@/store/store';

// Once per browser session — the notifier remounts on every route change (App keys the tree by path).
const seenKey = (userId: string) => `moodeng-kyc-declined-prompt:${userId}`;

const wasSeen = (userId: string): boolean => {
   try {
      return window.sessionStorage.getItem(seenKey(userId)) === '1';
   } catch {
      return false;
   }
};

const markSeen = (userId: string) => {
   try {
      window.sessionStorage.setItem(seenKey(userId), '1');
   } catch {
      // Storage unavailable — worst case the prompt shows again on the next page.
   }
};

/**
 * When a borrower whose ID check was declined comes back, tell them straight away and ask them to
 * connect Messenger so the team can talk them through it. /verify opens on the Messenger step for a
 * declined borrower without a line (then the decline details); connecting pings the admins.
 * Shown once per session; the dashboard keeps a card until they connect.
 */
export function KycDeclinedNotifier() {
   const user = useSelector((state: RootState) => state.auth.user);
   const navigate = useNavigate();
   const location = useLocation();
   const [isOpen, setIsOpen] = useState(false);

   const isDeclined = user?.userRole === 'borrower' && getVerificationUiState(user) === 'declined';
   const onVerifyPage = location.pathname.startsWith('/verify') || location.pathname.startsWith('/onboarding');

   useEffect(() => {
      if (!user?.id || !isDeclined || user.hasVerifiedContact || onVerifyPage || wasSeen(user.id)) return;
      markSeen(user.id);
      setIsOpen(true);
   }, [user?.id, user?.hasVerifiedContact, isDeclined, onVerifyPage]);

   const close = useCallback(() => setIsOpen(false), []);
   const connect = useCallback(() => {
      setIsOpen(false);
      navigate('/verify');
   }, [navigate]);

   if (!isOpen || onVerifyPage) return null;

   return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#12071f]/50 px-5 backdrop-blur-[2px]" onClick={close}>
         <div
            aria-modal="true"
            className="flex w-full max-w-modal flex-col items-center gap-md-4 rounded-md-lg bg-md-neutral-100 p-md-4 text-center"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
         >
            <img alt="" aria-hidden="true" className="size-24 object-contain" src="/hippos/hippo-with-id-card.png" />
            <div className="flex flex-col gap-2">
               <p className="text-md-h4 font-bold text-md-heading">Your ID check didn&apos;t go through</p>
               <p className="text-md-b3 text-md-neutral-700">
                  That happens — let&apos;s sort it out together. Connect Messenger and the team will message you to help.
               </p>
            </div>
            <div className="flex w-full flex-col gap-2">
               <button className="w-full rounded-md-md bg-md-primary-900 px-4 py-3 text-md-b3 font-semibold text-white" onClick={connect} type="button">
                  Connect Messenger
               </button>
               <button className="w-full rounded-md-md bg-md-neutral-200 px-4 py-3 text-md-b3 font-semibold text-md-heading" onClick={close} type="button">
                  Later
               </button>
            </div>
         </div>
      </div>
   );
}
