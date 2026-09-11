import { useEffect, useState } from 'react';

import {
   EMPTY_DEFAULTED_BORROWER_SUPPORT,
   calculateDefaultedBorrowerSupport,
   type DefaultedBorrowerSupport
} from '@/lib/defaultedBorrowerSupport';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import { LOAN_OVERDUE_GRACE_HOURS } from '@/utils/loanOverdue';

type DefaultedBorrowerSupportState = {
   support: DefaultedBorrowerSupport;
   isLoading: boolean;
   error: string | null;
   checkedUserId: string | null;
};

export async function fetchDefaultedBorrowerSupport(userId: string): Promise<DefaultedBorrowerSupport> {
   if (!isSupabaseBrowserConfigured()) {
      return EMPTY_DEFAULTED_BORROWER_SUPPORT;
   }

   // Only loans past the 24h grace window count as defaulted — a loan due today (within grace) must
   // not flag the borrower, or they get bounced to /account-restricted and can't reach /repay to pay
   // it off. Mirrors the lender-side grace (PR #872/#873) and the loan-overdue-notifications job.
   // calculateDefaultedBorrowerSupport re-applies the same graced check as a safety net.
   const graceThreshold = new Date(Date.now() - LOAN_OVERDUE_GRACE_HOURS * 60 * 60 * 1000).toISOString();
   const supabase = getSupabaseBrowserClient();
   const { data, error } = await supabase
      .from('loans')
      .select('due_date, loan_status, repayment_status, repaid_amount, total_repayment_amount')
      .eq('borrower_user_id', userId)
      .eq('loan_status', 'Lent')
      .neq('repayment_status', 'Paid')
      .lt('due_date', graceThreshold);

   if (error) {
      throw new Error(error.message);
   }

   return calculateDefaultedBorrowerSupport(data ?? []);
}

export function useDefaultedBorrowerSupport(userId?: string | null, refreshKey?: unknown): DefaultedBorrowerSupportState {
   const [state, setState] = useState<DefaultedBorrowerSupportState>({
      support: EMPTY_DEFAULTED_BORROWER_SUPPORT,
      isLoading: false,
      error: null,
      checkedUserId: null
   });

   useEffect(() => {
      let isMounted = true;

      if (!userId) {
         setState({
            support: EMPTY_DEFAULTED_BORROWER_SUPPORT,
            isLoading: false,
            error: null,
            checkedUserId: null
         });
         return () => {
            isMounted = false;
         };
      }

      if (!isSupabaseBrowserConfigured()) {
         setState({
            support: EMPTY_DEFAULTED_BORROWER_SUPPORT,
            isLoading: false,
            error: 'Supabase is not configured.',
            checkedUserId: userId
         });
         return () => {
            isMounted = false;
         };
      }

      setState((current) => ({
         ...current,
         isLoading: true,
         error: null
      }));

      const fetchDefaultedLoans = async () => {
         try {
            const support = await fetchDefaultedBorrowerSupport(userId);

            if (!isMounted) {
               return;
            }

            setState({
               support,
               isLoading: false,
               error: null,
               checkedUserId: userId
            });
         } catch (error) {
            if (!isMounted) {
               return;
            }

            setState({
               support: EMPTY_DEFAULTED_BORROWER_SUPPORT,
               isLoading: false,
               error: error instanceof Error ? error.message : 'Unable to check overdue loans.',
               checkedUserId: userId
            });
         }
      };

      void fetchDefaultedLoans();

      return () => {
         isMounted = false;
      };
      // refreshKey deliberately re-runs this fetch when loan data changes elsewhere (e.g. after
      // a repayment), since overdueAmount would otherwise stay stale for the rest of the session.
   }, [userId, refreshKey]);

   if (userId && state.checkedUserId !== userId) {
      return {
         support: EMPTY_DEFAULTED_BORROWER_SUPPORT,
         isLoading: true,
         error: null
      };
   }

   return {
      support: state.support,
      isLoading: state.isLoading,
      error: state.error
   };
}
