import { useEffect, useState } from 'react';

import { useDispatch } from 'react-redux';

import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch } from '@/store/store';

interface UseLoanDataOptions {
   userId: string | null | undefined;
   enabled?: boolean;
}

/**
 * Custom hook to fetch user loan data
 * Consolidates duplicate loan fetching logic across components
 * @param options - Configuration object with username and optional enabled flag
 */
export function useLoanData({ userId, enabled = true }: UseLoanDataOptions) {
   const dispatch = useDispatch<AppDispatch>();
   const [isLoading, setIsLoading] = useState(false);
   const [hasFetched, setHasFetched] = useState(false);
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      if (!enabled || !userId) {
         setIsLoading(false);
         setHasFetched(false);
         setError(null);
         return;
      }

      let isMounted = true;
      setIsLoading(true);
      setHasFetched(false);
      setError(null);

      const fetchLoans = async () => {
         await dispatch(getUserLoans({ userId }))
            .unwrap()
            .then(() => {
               console.log('Loan fetched successfully');
            })
            .catch((error: Error) => {
               console.error('Error fetching loan:', error.message || error);
               if (isMounted) setError(error.message || 'Failed to fetch loans');
            })
            .finally(() => {
               if (!isMounted) return;
               setIsLoading(false);
               setHasFetched(true);
            });
      };

      fetchLoans();

      return () => {
         isMounted = false;
      };
   }, [dispatch, userId, enabled]);

   return { error, hasFetched, isLoading };
}
