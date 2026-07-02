import { useCallback, useEffect, useState } from 'react';

import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import { isUserVerified, isVerificationPending } from '@/lib/isUserVerified';
import type { RootState } from '@/store/store';

// Written while a user is pending (documents submitted, no verdict yet) so we can
// tell "just got approved" apart from "was verified all along" — only browsers that
// watched the pending state celebrate. Value records whether it was a manual review.
const pendingKey = (userId: string) => `moodeng-verify-pending:${userId}`;

const readPending = (userId: string): string | null => {
   try {
      return window.localStorage.getItem(pendingKey(userId));
   } catch {
      return null;
   }
};

const writePending = (userId: string, value: string) => {
   try {
      window.localStorage.setItem(pendingKey(userId), value);
   } catch {
      // Storage unavailable — worst case, no celebration modal.
   }
};

const clearPending = (userId: string) => {
   try {
      window.localStorage.removeItem(pendingKey(userId));
   } catch {
      // Ignore.
   }
};

/**
 * Shows a one-time "you're verified!" modal when a user who was pending Didit
 * verification (including manual review) comes back approved. The /verify page has
 * its own success screen for the live-polling path; this covers the delayed path
 * where the webhook lands while the user is elsewhere in the app (or away).
 */
export function VerifiedCelebrationNotifier() {
   const user = useSelector((state: RootState) => state.auth.user);
   const navigate = useNavigate();
   const location = useLocation();
   const [celebration, setCelebration] = useState<'review' | 'pending' | null>(null);

   useEffect(() => {
      if (!user?.id) return;

      if (isVerificationPending(user)) {
         const rawStatus = user.diditIdStatus?.toLowerCase() ?? '';
         // Declined/abandoned aren't "pending approval" — don't arm the celebration.
         if (rawStatus === 'declined' || rawStatus === 'abandoned' || rawStatus === 'expired' || rawStatus === 'duplicate') {
            clearPending(user.id);
            return;
         }
         writePending(user.id, rawStatus.includes('review') ? 'review' : 'pending');
         return;
      }

      if (isUserVerified(user)) {
         const flag = readPending(user.id);
         if (flag) {
            clearPending(user.id);
            // If approval landed while the user was live-polling on /verify, that page
            // shows its own success screen (then navigates to a congratulations page) —
            // arming the modal here would double-celebrate. Clearing the flag is enough.
            if (!window.location.pathname.startsWith('/verify')) {
               setCelebration(flag === 'review' ? 'review' : 'pending');
            }
         }
      }
   }, [user]);

   const close = useCallback(() => setCelebration(null), []);

   const goToRequestBoard = useCallback(() => {
      setCelebration(null);
      navigate('/request-board', { state: { openLoanRequest: true } });
   }, [navigate]);

   // The /verify page has its own success screen — don't stack a modal on top of it.
   if (!celebration || location.pathname.startsWith('/verify')) {
      return null;
   }

   return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#12071f]/50 backdrop-blur-[2px] px-5" onClick={close}>
         <div
            className="bg-md-neutral-100 rounded-md-lg p-md-4 w-full max-w-modal flex flex-col gap-md-4 items-center text-center"
            onClick={(e) => e.stopPropagation()}
         >
            <img src="/hippos/welcome.png" alt="Moodeng" className="w-24 h-24 object-contain" />
            <div className="flex flex-col gap-2">
               <p className="text-md-heading text-md-h4 font-bold">
                  {celebration === 'review' ? 'Manual review complete — you’re verified!' : 'Your ID is verified!'}
               </p>
               <p className="text-md-neutral-700 text-md-b3">
                  {celebration === 'review'
                     ? 'Well done! Our reviewers confirmed your documents. You now have full access — start building trust with lenders.'
                     : 'Well done! Your identity is confirmed. You now have full access — start building trust with lenders.'}
               </p>
            </div>
            <div className="flex flex-col gap-2 w-full">
               <button
                  type="button"
                  onClick={goToRequestBoard}
                  className="w-full px-4 py-3 rounded-md-md bg-md-primary-900 text-white text-md-b3 font-semibold"
               >
                  Request a loan
               </button>
               <button
                  type="button"
                  onClick={close}
                  className="w-full px-4 py-3 rounded-md-md bg-md-neutral-200 text-md-heading text-md-b3 font-semibold"
               >
                  Done
               </button>
            </div>
         </div>
      </div>
   );
}
