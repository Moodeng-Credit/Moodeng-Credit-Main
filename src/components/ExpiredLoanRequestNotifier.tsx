import { useEffect } from 'react';

import { useSelector } from 'react-redux';

import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

import { REQUEST_EXPIRATION_DAYS } from '@/lib/borrowerCreditUsage';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import { type RootState } from '@/store/store';
import { LoanStatus } from '@/types/loanTypes';

const TOAST_STORAGE_PREFIX = 'moodeng-expired-loan-request-toast';

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

         const { data, count, error } = await getSupabaseBrowserClient()
            .from('loans')
            .select('id, tracking_id, loan_amount, created_at', { count: 'exact' })
            .eq('borrower_user_id', user.id)
            .eq('loan_status', LoanStatus.REQUESTED)
            .lte('created_at', expiredBefore.toISOString())
            .order('created_at', { ascending: false })
            .limit(5);

         if (cancelled || error || !data?.length) {
            return;
         }

         const newestRequest = data[0];
         const storageKey = `${TOAST_STORAGE_PREFIX}:${user.id}:${newestRequest.id}`;

         if (window.sessionStorage.getItem(storageKey)) {
            return;
         }

         window.sessionStorage.setItem(storageKey, '1');

         const expiredCount = count ?? data.length;
         const title = expiredCount === 1 ? 'Loan request expired' : 'Loan requests expired';
         const message =
            expiredCount === 1
               ? `Your ${formatUsdcAmount(newestRequest.loan_amount)} request expired before it was funded. Contact support if you need help connecting with a lender or deciding whether to post again.`
               : `${expiredCount} loan requests expired before they were funded. Contact support if you need help connecting with a lender or deciding whether to post again.`;

         showToast(TOAST_TYPES.WARNING, title, message, 'Contact support', 'contact_support');
      };

      void checkExpiredRequests();

      return () => {
         cancelled = true;
      };
   }, [isAuthChecked, showToast, user?.id, user?.userRole, username]);

   return null;
}
