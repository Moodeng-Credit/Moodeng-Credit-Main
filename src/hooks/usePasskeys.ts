import { useCallback, useEffect, useState } from 'react';

import type { PasskeyListItem } from '@supabase/supabase-js';

import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';

export type { PasskeyListItem };

interface UsePasskeysState {
   passkeys: PasskeyListItem[];
   isLoading: boolean;
}

const EMPTY_STATE: UsePasskeysState = { passkeys: [], isLoading: false };

/**
 * True when the browser can run a WebAuthn ceremony at all. Older browsers and some
 * in-app webviews (a real chunk of our traffic) have no `PublicKeyCredential`, so the
 * passkey UI is hidden rather than offered and then failing at the prompt.
 */
export function isPasskeySupported(): boolean {
   return typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function';
}

/**
 * Wrapper around `supabase.auth.passkey.*` plus `auth.registerPasskey()`.
 *
 * Passkeys are a *sign-in* credential here, NOT a second factor: registering one does
 * not raise the session to aal2 and `ProtectedRoute` never challenges for it. That is a
 * deliberate trade — WebAuthn-as-an-MFA-factor is a paid Supabase add-on, while this
 * passkey API is free. TOTP (see useMfa.ts) remains the only true 2FA.
 */
export function usePasskeys() {
   const [state, setState] = useState<UsePasskeysState>({ ...EMPTY_STATE, isLoading: true });

   const refresh = useCallback(async () => {
      if (!isSupabaseBrowserConfigured() || !isPasskeySupported()) {
         setState(EMPTY_STATE);
         return;
      }

      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.passkey.list();
      if (error || !data) {
         setState(EMPTY_STATE);
         return;
      }

      setState({ passkeys: data, isLoading: false });
   }, []);

   useEffect(() => {
      void refresh();
   }, [refresh]);

   /**
    * One call runs the whole ceremony: fetch a challenge, prompt the user for Face ID /
    * Touch ID / a security key, and verify. The friendly name is derived server-side from
    * the authenticator (e.g. "iCloud Keychain", "1Password") rather than passed in — that
    * tells the user *where* the passkey lives, which a generic label wouldn't.
    */
   const registerPasskey = useCallback(async () => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.registerPasskey();
      if (error) throw error;
      await refresh();
   }, [refresh]);

   const removePasskey = useCallback(
      async (passkeyId: string) => {
         const supabase = getSupabaseBrowserClient();
         const { error } = await supabase.auth.passkey.delete({ passkeyId });
         if (error) throw error;
         await refresh();
      },
      [refresh]
   );

   /**
    * Settings shows passkeys as one on/off row, so "Remove" clears every registered
    * passkey rather than just one — otherwise a user with a second device would flip the
    * row to "Not set up" while still being able to sign in with the passkey left behind.
    */
   const removeAllPasskeys = useCallback(async () => {
      const supabase = getSupabaseBrowserClient();
      for (const passkey of state.passkeys) {
         const { error } = await supabase.auth.passkey.delete({ passkeyId: passkey.id });
         if (error) throw error;
      }
      await refresh();
   }, [refresh, state.passkeys]);

   return {
      ...state,
      isSupported: isPasskeySupported(),
      refresh,
      registerPasskey,
      removePasskey,
      removeAllPasskeys
   };
}
