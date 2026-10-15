import { useCallback, useEffect, useState } from 'react';

import { useSelector } from 'react-redux';

import { ACCOUNT_EMAIL_CHANGED_EVENT, hasRealEmail } from '@/lib/accountEmail';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import type { RootState } from '@/store/store';

/**
 * The account's email situation from Supabase Auth: whether it has a real (confirmed) email, and
 * the pending address waiting for confirmation (`user.new_email`), if any.
 */
export function useAccountEmail(): { isLoading: boolean; needsEmail: boolean; pendingEmail: string | null; refresh: () => void } {
   const profileEmail = useSelector((state: RootState) => state.auth.user?.email);
   const [state, setState] = useState<{ isLoading: boolean; authEmail: string | null; pendingEmail: string | null }>({
      isLoading: true,
      authEmail: null,
      pendingEmail: null
   });
   const [version, setVersion] = useState(0);
   const refresh = useCallback(() => setVersion((v) => v + 1), []);

   useEffect(() => {
      const onChange = () => refresh();
      window.addEventListener(ACCOUNT_EMAIL_CHANGED_EVENT, onChange);
      return () => window.removeEventListener(ACCOUNT_EMAIL_CHANGED_EVENT, onChange);
   }, [refresh]);

   useEffect(() => {
      if (!isSupabaseBrowserConfigured()) {
         setState({ isLoading: false, authEmail: null, pendingEmail: null });
         return;
      }
      let cancelled = false;
      getSupabaseBrowserClient()
         .auth.getUser()
         .then(({ data }) => {
            if (cancelled) return;
            setState({ isLoading: false, authEmail: data.user?.email || null, pendingEmail: data.user?.new_email || null });
         })
         .catch(() => {
            if (!cancelled) setState((s) => ({ ...s, isLoading: false }));
         });
      return () => {
         cancelled = true;
      };
   }, [version]);

   return {
      isLoading: state.isLoading,
      needsEmail: !state.isLoading && !hasRealEmail(state.authEmail, profileEmail),
      pendingEmail: state.pendingEmail,
      refresh
   };
}
