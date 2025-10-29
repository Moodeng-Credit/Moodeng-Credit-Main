import { useEffect } from 'react';

import { useDispatch } from 'react-redux';

import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch } from '@/store/store';

interface UseLoanDataOptions {
   username: string | null | undefined;
   enabled?: boolean;
}

/**
 * Custom hook to fetch user loan data
 * Consolidates duplicate loan fetching logic across components
 * @param options - Configuration object with username and optional enabled flag
 */
export function useLoanData({ username, enabled = true }: UseLoanDataOptions) {
   const dispatch = useDispatch<AppDispatch>();

   useEffect(() => {
      if (!enabled || !username) return;

      const fetchLoans = async () => {
         await dispatch(getUserLoans(username))
            .unwrap()
            .then(() => {
               console.log('Loan fetched successfully');
            })
            .catch((error: Error) => {
               console.error('Error fetching loan:', error.message || error);
            });
      };

      fetchLoans();
   }, [dispatch, username, enabled]);
}
