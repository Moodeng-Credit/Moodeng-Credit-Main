import { useCallback, useEffect, useState } from 'react';

import type { Factor } from '@supabase/supabase-js';

import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';

export type { Factor };

interface UseMfaState {
   factors: Factor[];
   totpFactor: Factor | null;
   passkeyFactor: Factor | null;
   isLoading: boolean;
}

const EMPTY_STATE: UseMfaState = { factors: [], totpFactor: null, passkeyFactor: null, isLoading: false };

/**
 * Shared wrapper around `supabase.auth.mfa.*` for the optional TOTP/passkey 2FA
 * feature. Both factor types share this one hook because Supabase treats them
 * identically once enrolled — the only branching is which enroll call to make.
 */
export function useMfa() {
   const [state, setState] = useState<UseMfaState>({ ...EMPTY_STATE, isLoading: true });

   const refresh = useCallback(async () => {
      if (!isSupabaseBrowserConfigured()) {
         setState(EMPTY_STATE);
         return;
      }

      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error || !data) {
         setState(EMPTY_STATE);
         return;
      }

      // Unverified factors are abandoned enrollments (QR shown, never confirmed) — hide them
      // from the settings UI so a half-finished setup doesn't look like an active factor.
      const verified = data.all.filter((factor) => factor.status === 'verified');
      setState({
         factors: verified,
         totpFactor: verified.find((factor) => factor.factor_type === 'totp') ?? null,
         passkeyFactor: verified.find((factor) => factor.factor_type === 'webauthn') ?? null,
         isLoading: false
      });
   }, []);

   useEffect(() => {
      void refresh();
   }, [refresh]);

   /** Step 1 of TOTP enrollment: creates an unverified factor and returns its QR/secret. */
   const enrollTotp = useCallback(async (friendlyName?: string) => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName });
      if (error) throw error;
      return data;
   }, []);

   /**
    * Step 2 of TOTP enrollment: the 6-digit code from the authenticator app confirms the
    * factor. Supabase promotes the session to aal2 immediately on success, so no separate
    * login-time challenge is needed right after enrolling.
    */
   const verifyTotp = useCallback(
      async (factorId: string, code: string) => {
         const supabase = getSupabaseBrowserClient();
         const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
         if (error) throw error;
         await refresh();
      },
      [refresh]
   );

   /**
    * Passkey enrollment is a single call: Supabase's WebAuthn helper handles enroll,
    * challenge, the browser's Face ID/Touch ID/security-key prompt, and verify together.
    */
   const enrollPasskey = useCallback(
      async (friendlyName: string) => {
         const supabase = getSupabaseBrowserClient();
         const { error } = await supabase.auth.mfa.webauthn.register({ friendlyName });
         if (error) throw error;
         await refresh();
      },
      [refresh]
   );

   /**
    * Removing a verified factor requires an aal2 session — satisfied automatically here
    * because ProtectedRoute already forces anyone with a factor through the MFA challenge
    * before they can reach this settings screen.
    */
   const removeFactor = useCallback(
      async (factorId: string) => {
         const supabase = getSupabaseBrowserClient();
         const { error } = await supabase.auth.mfa.unenroll({ factorId });
         if (error) throw error;
         await refresh();
      },
      [refresh]
   );

   /** Best-effort cleanup for a QR/passkey prompt the user closed without finishing setup. */
   const cancelEnrollment = useCallback(async (factorId: string) => {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.mfa.unenroll({ factorId }).catch(() => undefined);
   }, []);

   return {
      ...state,
      refresh,
      enrollTotp,
      verifyTotp,
      enrollPasskey,
      removeFactor,
      cancelEnrollment
   };
}
