import { useEffect } from 'react';

import { useDispatch, useSelector } from 'react-redux';

import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';

export const useLoanData = (username: string) => {
   const dispatch = useDispatch<AppDispatch>();
   const loans = useSelector((state: RootState) => state.loans.loans.gloans);

   useEffect(() => {
      const fetchLoans = async () => {
         await dispatch(getUserLoans(username || ''))
            .unwrap()
            .then(() => {
               console.log('Loan fetched successfully');
            })
            .catch((error: Error) => {
               console.error('Error fetching loan:', error.message || error);
            });
      };

      if (username) {
         fetchLoans();
      }
   }, [dispatch, username]);

   return { loans };
};
