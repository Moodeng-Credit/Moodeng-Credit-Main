import { fetchDefaultedBorrowerSupport } from '@/hooks/useDefaultedBorrowerSupport';
import { clearPendingSharedRequestId, getPendingSharedRequestId } from '@/lib/pendingSharedRequest';

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

   // If they arrived via a shared request link before signing in, return them to that exact
   // request (opened on the board) instead of the generic dashboard.
   const sharedRequestId = getPendingSharedRequestId();
   if (sharedRequestId) {
      clearPendingSharedRequestId();
      return `/request-board?highlight=${encodeURIComponent(sharedRequestId)}`;
   }

   return '/dashboard';
};
