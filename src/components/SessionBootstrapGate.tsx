import { type ReactNode, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import Loading from '@/components/Loading';
import { bootstrapSession } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';

/**
 * Blocks the app until redux-persist rehydration has finished (PersistGate) and
 * `bootstrapSession` has synced the Supabase session with Redux.
 */
export function SessionBootstrapGate({ children }: { children: ReactNode }) {
   const dispatch = useDispatch<AppDispatch>();
   const status = useSelector((s: RootState) => s.auth.sessionBootstrapStatus ?? 'pending');
   const ran = useRef(false);

   useEffect(() => {
      if (ran.current) return;
      ran.current = true;
      void dispatch(bootstrapSession());
   }, [dispatch]);

   if (status !== 'ready') {
      return <Loading />;
   }

   return <>{children}</>;
}
