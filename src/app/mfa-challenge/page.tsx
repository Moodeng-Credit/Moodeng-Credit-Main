import { useEffect, useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { EXTERNAL_LINKS } from '@/config/externalLinks';
import { useMfa } from '@/hooks/useMfa';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { logoutUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';

/** Only allow returning to an internal path — never an absolute/external URL from router state. */
function safeReturnPath(from: unknown): string {
   if (from && typeof from === 'object' && 'pathname' in from) {
      const location = from as { pathname: string; search?: string };
      if (location.pathname.startsWith('/') && !location.pathname.startsWith('//')) {
         return `${location.pathname}${location.search ?? ''}`;
      }
   }
   return '/dashboard';
}

export default function MfaChallengePage() {
   const dispatch = useDispatch<AppDispatch>();
   const navigate = useNavigate();
   const location = useLocation();
   const username = useSelector((state: RootState) => state.auth.username);
   const userId = useSelector((state: RootState) => state.auth.user?.id);
   const isAuthenticated = Boolean(username && userId);

   const { totpFactor, passkeyFactor, isLoading: isLoadingFactors } = useMfa();
   const [activeMethod, setActiveMethod] = useState<'totp' | 'passkey' | null>(null);
   const [code, setCode] = useState('');
   const [error, setError] = useState('');
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [isSigningOut, setIsSigningOut] = useState(false);

   const returnPath = safeReturnPath((location.state as { from?: unknown } | null)?.from);

   // Default to the passkey prompt when both are available — fewer taps — but let the
   // user fall back to their authenticator app if the passkey isn't on this device.
   useEffect(() => {
      if (activeMethod || isLoadingFactors) return;
      if (passkeyFactor) setActiveMethod('passkey');
      else if (totpFactor) setActiveMethod('totp');
   }, [activeMethod, isLoadingFactors, passkeyFactor, totpFactor]);

   const handleVerifyTotp = async () => {
      if (!totpFactor || code.length !== 6) {
         setError('Enter the 6-digit code from your authenticator app');
         return;
      }
      setError('');
      setIsSubmitting(true);
      try {
         const supabase = getSupabaseBrowserClient();
         const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: totpFactor.id, code });
         if (verifyError) throw verifyError;
         navigate(returnPath, { replace: true });
      } catch (verifyError) {
         setError(verifyError instanceof Error ? verifyError.message : 'That code did not work. Try again.');
      } finally {
         setIsSubmitting(false);
      }
   };

   const handleUsePasskey = async () => {
      if (!passkeyFactor) return;
      setError('');
      setIsSubmitting(true);
      try {
         const supabase = getSupabaseBrowserClient();
         const { error: authError } = await supabase.auth.mfa.webauthn.authenticate({ factorId: passkeyFactor.id });
         if (authError) throw authError;
         navigate(returnPath, { replace: true });
      } catch (authError) {
         setError(authError instanceof Error ? authError.message : 'Passkey confirmation failed. Try again.');
      } finally {
         setIsSubmitting(false);
      }
   };

   const handleSignOut = async () => {
      if (isSigningOut) return;
      setIsSigningOut(true);
      await dispatch(logoutUser());
      navigate('/sign-in', { replace: true });
   };

   if (!isAuthenticated) {
      return <Navigate to="/sign-in" replace />;
   }

   // No verified factor to challenge (shouldn't normally happen — ProtectedRoute only
   // sends users here when Supabase reports an aal1→aal2 step-up is pending) — don't
   // strand them on a dead-end screen.
   if (!isLoadingFactors && !totpFactor && !passkeyFactor) {
      return <Navigate to={returnPath} replace />;
   }

   return (
      <div className="min-h-screen bg-[#FBFAFD] px-4 py-6 text-[#040033] dark:bg-[#0D0B14] dark:text-[#F0EAFF] sm:px-6 sm:py-10">
         <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[480px] flex-col justify-center">
            <section className="rounded-[28px] border border-[#E7D8FF] bg-[#FDFCFD] px-5 py-7 shadow-[0_18px_50px_rgba(36,14,62,0.08)] dark:border-[#2D1F4A] dark:bg-[#160F28] sm:px-7">
               <div className="mb-7 flex flex-col items-center text-center">
                  <p className="mb-2 text-sm font-extrabold uppercase tracking-[0.18em] text-[#8336F0] dark:text-[#C084FC]">
                     Verify it's you
                  </p>
                  <h1 className="text-[30px] font-semibold leading-[1.08] tracking-[-0.04em] text-[#040033] dark:text-[#F0EAFF]">
                     Two-factor authentication
                  </h1>
                  <p className="mt-3 max-w-[340px] text-base font-medium leading-6 tracking-[-0.02em] text-[#70617F] dark:text-[#A89BB8]">
                     {activeMethod === 'passkey'
                        ? 'Confirm with your passkey to finish signing in.'
                        : 'Enter the code from your authenticator app to finish signing in.'}
                  </p>
               </div>

               {activeMethod === 'passkey' ? (
                  <div className="space-y-5">
                     <button
                        type="button"
                        onClick={() => void handleUsePasskey()}
                        disabled={isSubmitting}
                        className="h-14 w-full rounded-2xl bg-[#6010D2] text-base font-semibold tracking-[-0.02em] text-[#FDFCFD] transition hover:opacity-95 disabled:opacity-60"
                     >
                        {isSubmitting ? 'Waiting for your device...' : 'Continue with passkey'}
                     </button>
                     {error ? (
                        <p className="rounded-2xl border border-[#FFD2D8] bg-[#FFF0F2] px-4 py-3 text-sm font-semibold leading-5 text-[#B60413] dark:border-[#4A1A20] dark:bg-[#2A0F14] dark:text-[#FF8090]">
                           {error}
                        </p>
                     ) : null}
                     {totpFactor ? (
                        <button
                           type="button"
                           onClick={() => {
                              setActiveMethod('totp');
                              setError('');
                           }}
                           disabled={isSubmitting}
                           className="w-full text-center text-sm font-semibold text-[#6010D2] hover:underline dark:text-[#C084FC]"
                        >
                           Use authenticator app instead
                        </button>
                     ) : null}
                  </div>
               ) : null}

               {activeMethod === 'totp' ? (
                  <form
                     onSubmit={(e) => {
                        e.preventDefault();
                        void handleVerifyTotp();
                     }}
                     className="space-y-5"
                  >
                     <div className="space-y-2">
                        <label
                           htmlFor="mfa-code"
                           className="text-base font-semibold tracking-[-0.02em] text-[#040033] dark:text-[#F0EAFF]"
                        >
                           Verification code
                        </label>
                        <input
                           id="mfa-code"
                           type="text"
                           inputMode="numeric"
                           autoComplete="one-time-code"
                           autoFocus
                           maxLength={6}
                           value={code}
                           onChange={(e) => {
                              setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                              setError('');
                           }}
                           placeholder="000000"
                           className="h-16 w-full rounded-2xl border border-[#B5ACBE] bg-[#FBFAFD] px-5 text-center text-[30px] font-semibold tracking-[0.18em] text-[#040033] shadow-[0_2px_4px_rgba(27,28,29,0.04)] outline-none placeholder:text-[#A99CB4] focus:border-[#8336F0] focus:ring-4 focus:ring-[#E9D8FF] dark:border-[#3D2D5A] dark:bg-[#1E1530] dark:text-[#F0EAFF] dark:placeholder:text-[#6B5880] dark:focus:border-[#C084FC] dark:focus:ring-[#2D1F4A]"
                        />
                     </div>

                     {error ? (
                        <p className="rounded-2xl border border-[#FFD2D8] bg-[#FFF0F2] px-4 py-3 text-sm font-semibold leading-5 text-[#B60413] dark:border-[#4A1A20] dark:bg-[#2A0F14] dark:text-[#FF8090]">
                           {error}
                        </p>
                     ) : null}

                     <button
                        type="submit"
                        disabled={isSubmitting || code.length !== 6}
                        className="h-14 w-full rounded-2xl bg-[#6010D2] text-base font-semibold tracking-[-0.02em] text-[#FDFCFD] transition hover:opacity-95 disabled:bg-[#BDB5C7] disabled:text-[#FDFCFD] dark:disabled:bg-[#2D1F4A] dark:disabled:text-[#6B5880]"
                     >
                        {isSubmitting ? 'Verifying...' : 'Verify'}
                     </button>

                     {passkeyFactor ? (
                        <button
                           type="button"
                           onClick={() => {
                              setActiveMethod('passkey');
                              setError('');
                           }}
                           disabled={isSubmitting}
                           className="w-full text-center text-sm font-semibold text-[#6010D2] hover:underline dark:text-[#C084FC]"
                        >
                           Use passkey instead
                        </button>
                     ) : null}
                  </form>
               ) : null}

               <div className="mt-6 flex flex-col items-center gap-2 text-center text-sm font-medium text-[#70617F] dark:text-[#A89BB8]">
                  <a href={EXTERNAL_LINKS.support.messenger} target="_blank" rel="noopener noreferrer" className="hover:underline">
                     Lost access to your authenticator or passkey? Contact support
                  </a>
                  <button type="button" onClick={() => void handleSignOut()} disabled={isSigningOut} className="hover:underline">
                     {isSigningOut ? 'Signing out...' : 'Not you? Sign out'}
                  </button>
               </div>
            </section>
         </div>
      </div>
   );
}
