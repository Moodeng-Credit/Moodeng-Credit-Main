import { useEffect } from 'react';

import { useSelector } from 'react-redux';

import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

import { REQUEST_EXPIRATION_DAYS } from '@/lib/borrowerCreditUsage';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import { type RootState } from '@/store/store';
import { LoanStatus } from '@/types/loanTypes';

const TOAST_STORAGE_PREFIX = 'moodeng-expired-loan-request-toast';

const getStoredToastValue = (storage: Storage, storageKey: string) => {
   try {
      return storage.getItem(storageKey);
   } catch {
      return null;
   }
};

const setStoredToastValue = (storage: Storage, storageKey: string) => {
   try {
      storage.setItem(storageKey, '1');
      return true;
   } catch {
      return false;
   }
};

const hasSeenExpiredRequestToast = (storageKey: string) => {
   const seenInLocalStorage = getStoredToastValue(window.localStorage, storageKey) === '1';
   const seenInSessionStorage = getStoredToastValue(window.sessionStorage, storageKey) === '1';

   if (!seenInLocalStorage && seenInSessionStorage) {
      setStoredToastValue(window.localStorage, storageKey);
   }

   return seenInLocalStorage || seenInSessionStorage;
};

const markExpiredRequestToastSeen = (storageKey: string) => {
   if (setStoredToastValue(window.localStorage, storageKey)) {
      return;
   }

   setStoredToastValue(window.sessionStorage, storageKey);
};

const formatUsdcAmount = (amount: number | string | null | undefined) => {
   const value = Number(amount ?? 0);
   const safeValue = Number.isFinite(value) ? value : 0;

   return `${new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2
   }).format(safeValue)} USDC`;
};

export function ExpiredLoanRequestNotifier() {
   const { user, username, isAuthChecked } = useSelector((state: RootState) => state.auth);
   const { showToast } = useToast();

   useEffect(() => {
      if (!isAuthChecked || !user?.id || !username || user.userRole !== 'borrower' || !isSupabaseBrowserConfigured()) {
         return;
      }

      let cancelled = false;

      const checkExpiredRequests = async () => {
         const expiredBefore = new Date();
         expiredBefore.setUTCDate(expiredBefore.getUTCDate() - REQUEST_EXPIRATION_DAYS);

         const { data, error } = await getSupabaseBrowserClient()
            .from('loans')
            .select('id, tracking_id, loan_amount, created_at')
            .eq('borrower_user_id', user.id)
            .eq('loan_status', LoanStatus.REQUESTED)
            .lte('created_at', expiredBefore.toISOString())
            .order('created_at', { ascending: false })
            .limit(5);

         if (cancelled || error || !data?.length) {
            return;
         }

         // Defer to the durable, cross-device record the backend writes once it has
         // reached the borrower about an expired request (email/Telegram — see the
         // loan-request-expired-notifications function). Only surface the in-app
         // toast for expired requests the backend has NOT already recorded a notice
         // for. Without this the toast re-derives "expired" from the permanent
         // `Requested` row and nags forever, on every device.
         const expiredLoanIds = data.map((loan) => loan.id);
         const { data: notifiedRows, error: notifiedError } = await getSupabaseBrowserClient()
            .from('loan_notifications')
            .select('loan_id')
            .eq('user_id', user.id)
            .eq('notification_type', 'request_expired')
            .in('loan_id', expiredLoanIds);

         if (cancelled) {
            return;
         }

         // Fail closed: if we can't confirm what was already notified, don't nag.
         if (notifiedError) {
            return;
         }

         const notifiedLoanIds = new Set((notifiedRows ?? []).map((row) => row.loan_id as string));
         const unnotifiedRequests = data.filter((loan) => !notifiedLoanIds.has(loan.id));

         if (!unnotifiedRequests.length) {
            return;
         }

         const newestRequest = unnotifiedRequests[0];
         // Key by user only (not by request id) so the expired-request toast is
         // shown at most once per person on this device. Keying by request id
         // re-triggered a new toast every time another request expired, which read
         // as it "keeps showing up". (Cross-device suppression comes from the
         // loan_notifications record check above.)
         const storageKey = `${TOAST_STORAGE_PREFIX}:${user.id}`;

         if (hasSeenExpiredRequestToast(storageKey)) {
            return;
         }

         markExpiredRequestToastSeen(storageKey);

         const expiredCount = unnotifiedRequests.length;
         const title = expiredCount === 1 ? 'Loan request expired' : 'Loan requests expired';
         const message =
            expiredCount === 1
               ? `Your ${formatUsdcAmount(newestRequest.loan_amount)} request expired before it was funded. Contact support if you need help connecting with a lender or deciding whether to post again.`
               : `${expiredCount} loan requests expired before they were funded. Contact support if you need help connecting with a lender or deciding whether to post again.`;

         showToast(TOAST_TYPES.WARNING, title, message, 'Contact support', 'open_support_contacts', {
            supportIssue: 'loan_request_expired'
         });
      };

      void checkExpiredRequests();

      return () => {
         cancelled = true;
      };
   }, [isAuthChecked, showToast, user?.id, user?.userRole, username]);

   return null;
}
