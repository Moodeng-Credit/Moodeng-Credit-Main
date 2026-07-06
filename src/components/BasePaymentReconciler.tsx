import { useEffect } from 'react';

import { useDispatch } from 'react-redux';

import { reconcilePendingBasePayments } from '@/lib/basePayReconciliation';
import { recordWithdrawal } from '@/lib/recordWithdrawal';
import { recordInterestReturn, updateLoanStatus } from '@/store/slices/loanSlice';
import type { AppDispatch } from '@/store/store';

// Base Pay confirms in seconds, so a stranded payment is rare; a light cadence is plenty.
const RECONCILE_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Finishes the DB write for any Base Pay payment that was approved but whose confirmation the
 * live payUsdc call never got to record (timed out, or the tab was closed mid-poll). Runs once on
 * mount and on a slow interval; the store only reconciles entries older than its own guard window,
 * so this never races an in-flight payment. See [[base-pay-migration]], [[funding-desync-recovery]].
 */
export default function BasePaymentReconciler() {
   const dispatch = useDispatch<AppDispatch>();

   useEffect(() => {
      const run = () =>
         void reconcilePendingBasePayments({
            completeFund: async ({ loanId, userId, wallet, hash }) => {
               await dispatch(updateLoanStatus({ id: loanId, userId, wallet, loanStatus: 'Lent', hash })).unwrap();
            },
            completeRepay: async ({ loanId, repaidAmount, repaymentStatus, hash }) => {
               await dispatch(updateLoanStatus({ id: loanId, repaidAmount, repaymentStatus, hash })).unwrap();
            },
            completeInterest: async ({ loanId, hash }) => {
               await dispatch(recordInterestReturn({ loanId, hash })).unwrap();
            },
            completeWithdraw: async ({ userId, amount, exchange, address, hash }) => {
               await recordWithdrawal({ userId, amount, exchange, address, txHash: hash });
            }
         });

      run();
      const interval = window.setInterval(run, RECONCILE_INTERVAL_MS);
      return () => window.clearInterval(interval);
   }, [dispatch]);

   return null;
}
