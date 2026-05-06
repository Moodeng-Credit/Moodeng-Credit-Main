import { useEffect, useState } from 'react';

import {
   EMPTY_DEFAULTED_BORROWER_SUPPORT,
   calculateDefaultedBorrowerSupport,
   type DefaultedBorrowerSupport
} from '@/lib/defaultedBorrowerSupport';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';

type DefaultedBorrowerSupportState = {
   support: DefaultedBorrowerSupport;
   isLoading: boolean;
   error: string | null;
};

export async function fetchDefaultedBorrowerSupport(userId: string): Promise<DefaultedBorrowerSupport> {
   if (!isSupabaseBrowserConfigured()) {
      return EMPTY_DEFAULTED_BORROWER_SUPPORT;
   }

   const supabase = getSupabaseBrowserClient();
   const { data, error } = await supabase
      .from('loans')
      .select('due_date, loan_status, repayment_status, repaid_amount, total_repayment_amount')
      .eq('borrower_user_id', userId)
      .eq('loan_status', 'Lent')
      .neq('repayment_status', 'Paid')
      .lt('due_date', new Date().toISOString());

   if (error) {
      throw new Error(error.message);
   }

   return calculateDefaultedBorrowerSupport(data ?? []);
}

export function useDefaultedBorrowerSupport(userId?: string | null): DefaultedBorrowerSupportState {
   const [state, setState] = useState<DefaultedBorrowerSupportState>({
      support: EMPTY_DEFAULTED_BORROWER_SUPPORT,
      isLoading: false,
      error: null
   });

   useEffect(() => {
      let isMounted = true;

      if (!userId) {
         setState({
            support: EMPTY_DEFAULTED_BORROWER_SUPPORT,
            isLoading: false,
            error: null
         });
         return () => {
            isMounted = false;
         };
      }

      if (!isSupabaseBrowserConfigured()) {
         setState({
            support: EMPTY_DEFAULTED_BORROWER_SUPPORT,
            isLoading: false,
            error: 'Supabase is not configured.'
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
               error: null
            });
         } catch (error) {
            if (!isMounted) {
               return;
            }

            setState({
               support: EMPTY_DEFAULTED_BORROWER_SUPPORT,
               isLoading: false,
               error: error instanceof Error ? error.message : 'Unable to check overdue loans.'
            });
         }
      };

      void fetchDefaultedLoans();

      return () => {
         isMounted = false;
      };
   }, [userId]);

   return state;
}
