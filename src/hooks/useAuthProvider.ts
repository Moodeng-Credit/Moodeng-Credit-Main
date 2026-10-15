import { useCallback, useEffect, useState } from 'react';

import type { User as SupabaseAuthUser } from '@supabase/supabase-js';

import { isPlaceholderEmail } from '@/lib/phoneAuth';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';

type AuthProvider = 'email' | 'phone' | 'google' | 'facebook' | 'telegram' | 'line' | null;

/**
 * Whether this account can sign in with a password. Supabase does not expose that to the browser,
 * so: passwordless sign-ups are tagged `passwordless` when the account is created, and setting a
 * password later tags `has_password`. Older email accounts (no tag) signed up with a password.
 */
export function accountHasPassword(user: Pick<SupabaseAuthUser, 'app_metadata' | 'user_metadata'>): boolean {
   if (user.user_metadata?.has_password === true) return true;
   if (user.user_metadata?.passwordless === true) return false;
   return user.app_metadata?.provider === 'email';
}

const readProvider = (user: SupabaseAuthUser): AuthProvider => {
   const p = user.app_metadata?.provider as string | undefined;
   const providers = (user.app_metadata?.providers as string[] | undefined) ?? [];
   if (p === 'google') return 'google';
   if (p === 'facebook' || providers.includes('facebook')) return 'facebook';
   if (p === 'telegram' || providers.includes('telegram')) return 'telegram';
   if (p === 'line' || providers.includes('line')) return 'line';
   if (p === 'phone') return 'phone';
   return 'email';
};

/**
 * Returns the auth provider from the Supabase session's `app_metadata.provider`, plus the sign-in
 * details Account settings needs (password yes/no, the phone and email Supabase Auth holds).
 * Use this to determine if a user signed up with Google/Telegram (and thus cannot change email/password).
 */
export function useAuthProvider(): {
   provider: AuthProvider;
   isEmailPasswordUser: boolean;
   /** Signed up with an email or PH phone code (or an email + password): can set/change a password. */
   isCodeOrPasswordUser: boolean;
   hasPassword: boolean;
   /**
    * Can add a password: a code/password account with a real email. Password login is email-only,
    * so phone-only accounts aren't offered one (it couldn't be used to log in).
    */
   canSetPassword: boolean;
   authPhone: string | null;
   authEmail: string | null;
   isLoading: boolean;
   refresh: () => void;
} {
   const [provider, setProvider] = useState<AuthProvider>(null);
   const [hasPassword, setHasPassword] = useState(false);
   const [authPhone, setAuthPhone] = useState<string | null>(null);
   const [authEmail, setAuthEmail] = useState<string | null>(null);
   const [isLoading, setIsLoading] = useState(true);
   const [version, setVersion] = useState(0);
   const refresh = useCallback(() => setVersion((v) => v + 1), []);

   useEffect(() => {
      if (!isSupabaseBrowserConfigured()) {
         setProvider(null);
         setIsLoading(false);
         return;
      }

      const supabase = getSupabaseBrowserClient();
      supabase.auth
         .getUser()
         .then(({ data, error }) => {
            if (error || !data.user) {
               setProvider(null);
               setIsLoading(false);
               return;
            }

            setProvider(readProvider(data.user));
            setHasPassword(accountHasPassword(data.user));
            // Supabase stores phones without the "+".
            setAuthPhone(data.user.phone ? `+${data.user.phone.replace(/^\+/, '')}` : null);
            setAuthEmail(data.user.email || null);
            setIsLoading(false);
         })
         .catch(() => {
            setProvider(null);
            setIsLoading(false);
         });
   }, [version]);

   return {
      provider,
      isEmailPasswordUser: provider === 'email',
      isCodeOrPasswordUser: provider === 'email' || provider === 'phone',
      hasPassword,
      canSetPassword: (provider === 'email' || provider === 'phone') && Boolean(authEmail) && !isPlaceholderEmail(authEmail),
      authPhone,
      authEmail,
      isLoading,
      refresh
   };
}
