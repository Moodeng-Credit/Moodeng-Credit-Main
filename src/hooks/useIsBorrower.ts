import { useSelector } from 'react-redux';

import type { RootState } from '@/store/store';

export function useIsBorrower(): boolean {
   const userRole = useSelector((state: RootState) => state.auth.user?.userRole);
   return (userRole ?? 'borrower') !== 'lender';
}
