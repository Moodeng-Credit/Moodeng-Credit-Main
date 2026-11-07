import { fetchDefaultedBorrowerSupport } from '@/hooks/useDefaultedBorrowerSupport';

import { takeNextPath } from '@/lib/authNext';
import { clearPendingSharedRequestId, getPendingSharedRequestId } from '@/lib/pendingSharedRequest';
import { fetchIdTrackPath } from '@/views/indonesia/idFlow';

/**
 * Where a freshly signed-in user should land. Shared by the email/Google/Telegram sign-in page and
 * the TikTok/LINE OAuth callbacks so every provider applies the same restricted/defaulted check.
 */
export const getPostSignInPath = async (user: { id: string; accountStatus?: string }) => {
   if (user.accountStatus === 'blocked' || user.accountStatus === 'banned') {
      return '/account-restricted';
   }

   const defaultedBorrower = await fetchDefaultedBorrowerSupport(user.id);
   if (defaultedBorrower.overdueAmount > 0) return '/account-restricted';

   // Always consume the stored "next" path, even when the Indonesia track wins below, so it can't
   // leak into a later sign-in.
   const nextPath = takeNextPath();

   // Indonesia-track borrowers finish their own onboarding first.
   const idTrackPath = await fetchIdTrackPath();
   if (idTrackPath) return idTrackPath;

   // A protected page sent them to sign in: take them back there.
   if (nextPath) return nextPath;

   // If they arrived via a shared request link before signing in, return them to that exact
   // request (opened on the board) instead of the generic dashboard.
   const sharedRequestId = getPendingSharedRequestId();
   if (sharedRequestId) {
      clearPendingSharedRequestId();
      return `/request-board?highlight=${encodeURIComponent(sharedRequestId)}`;
   }

   return '/dashboard';
};
