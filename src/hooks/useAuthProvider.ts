import { useEffect, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type AuthProvider = 'email' | 'google' | 'telegram' | null;

/**
 * Returns the auth provider from the Supabase session's `app_metadata.provider`.
 * Use this to determine if a user signed up with Google/Telegram (and thus cannot change email/password).
 */
export function useAuthProvider(): { provider: AuthProvider; isEmailPasswordUser: boolean; isLoading: boolean } {
   const [provider, setProvider] = useState<AuthProvider>(null);
   const [isLoading, setIsLoading] = useState(true);

   useEffect(() => {
      const supabase = getSupabaseBrowserClient();
      supabase.auth
         .getUser()
         .then(({ data, error }) => {
            if (error || !data.user) {
               setProvider(null);
               setIsLoading(false);
               return;
            }

            const p = data.user.app_metadata?.provider as string | undefined;
            if (p === 'google') {
               setProvider('google');
            } else if (p === 'telegram' || data.user.app_metadata?.providers?.includes('telegram')) {
               setProvider('telegram');
            } else {
               setProvider('email');
            }
            setIsLoading(false);
         })
         .catch(() => {
            setProvider(null);
            setIsLoading(false);
         });
   }, []);

   return {
      provider,
      isEmailPasswordUser: provider === 'email',
      isLoading,
   };
}
