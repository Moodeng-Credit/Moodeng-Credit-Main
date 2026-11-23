import { useEffect, useMemo, useRef } from 'react';

import posthog from 'posthog-js';
import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { PasswordlessAuthForm } from '@/components/auth';

import { usePreKycGate } from '@/hooks/usePreKycGate';
import { getSignedInReturnPath } from '@/hooks/useSignedInRedirect';

import { rememberNextPath } from '@/lib/authNext';
import { detectInAppBrowser } from '@/lib/inAppBrowser';
import type { RootState } from '@/store/store';

// moodeng.app/continue — "pick up where you left off". The Messenger bot links here after it confirms a
// borrower who signed up inside Facebook's / Messenger's browser (sendpulse-messenger-verify), and the home
// page links here when this browser is still signed in (public/landing/site.js). On iPhone, Messenger's
// browser is thrown away when they close it to paste their code, so this is their way back.
//   * Signed in here: straight on to their next step (same rule as /sign-in for signed-in people).
//   * Not signed in: this is a different browser from the one they started in (Messenger's vs Facebook's,
//     or Safari). On Android, Messenger opens the link in its own browser, which doesn't share Facebook's
//     sign-in: 30 Android devices landed here signed out in the 2 weeks to 2026-11-23. The page used to
//     say only "go back to where you started", behind a "Sign in here instead" link that hit the
//     open-in-Chrome prompt. One borrower tapped it, then the link again, and left. So the code sign-in
//     (mobile number first in the Philippines) is right here now, and it comes back here once signed in,
//     which sends them on to their next step. Guest accounts (email typed in Facebook, never confirmed)
//     can't sign in again, so "go back to the Facebook app" stays under the form.

const track = (event: string, properties: Record<string, unknown>) => {
   try {
      posthog.capture(event, properties);
   } catch {
      // Analytics unavailable — the page works the same.
   }
};

export default function ContinuePage() {
   const navigate = useNavigate();
   const [searchParams] = useSearchParams();
   const via = searchParams.get('via') ?? 'direct';
   const user = useSelector((state: RootState) => state.auth.user);
   const username = useSelector((state: RootState) => state.auth.username);
   const isAuthChecked = useSelector((state: RootState) => state.auth.isAuthChecked);
   const isLoading = useSelector((state: RootState) => state.auth.isLoading);
   const gate = usePreKycGate();
   const signedIn = Boolean(user?.id && username);
   const settled = isAuthChecked && !isLoading;
   const tracked = useRef(false);
   const formTouched = useRef(false);
   const inApp = useMemo(() => detectInAppBrowser(), []);

   useEffect(() => {
      if (!settled || tracked.current) return;
      tracked.current = true;
      track('continue_opened', { signed_in: signedIn, via, in_app: inApp.isInApp, app: inApp.appName, os: inApp.os });
      // Signing in from the form below comes back here (the code screen reads it), then on to their step.
      if (!signedIn) rememberNextPath(`/continue?via=${encodeURIComponent(via)}`);
   }, [settled, signedIn, via, inApp]);

   useEffect(() => {
      if (!settled || !signedIn || gate.isLoading) return;
      let cancelled = false;
      // With the journey and pre-screening answers, so people on the pre-screening path go to /screen.
      void getSignedInReturnPath(user, gate.isGated, gate.v2, gate.prescreen)
         .catch(() => '/request-board')
         .then((path) => {
            if (!cancelled) navigate(path, { replace: true });
         });
      return () => {
         cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [settled, signedIn, gate.isLoading, gate.isGated, user?.id, navigate]);

   if (!settled || signedIn) {
      return (
         <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#08040f]">
            <img alt="" className="h-24 w-auto animate-pulse" src="/hippos/connect/hello.png" />
         </div>
      );
   }

   return (
      <div className="connect-ui flex min-h-screen items-start justify-center bg-gradient-to-b from-[#fbfafd] to-white px-4 pt-10 dark:from-[#08040f] dark:via-[#12091f] dark:to-[#08040f]">
         <div className="flex w-full max-w-[400px] flex-col items-center gap-4 text-center">
            <img alt="" className="h-28 w-auto" src="/hippos/connect/approved.png" />
            <h1 className="text-[24px] font-extrabold leading-[30px] text-[#26143f]">Sign in to continue</h1>
            <p className="text-[16px] leading-[22px] text-[#594d65]">
               Use the number or email you signed up with. We&apos;ll send you a code.
            </p>
            <div
               className="flex w-full justify-center"
               onFocusCapture={() => {
                  if (formTouched.current) return;
                  formTouched.current = true;
                  track('continue_sign_in_tapped', { via, inline: true });
               }}
            >
               <PasswordlessAuthForm inApp={inApp} mode="signin" />
            </div>
            <p className="mt-2 text-[15px] leading-[21px] text-[#877897]">
               Started in the <b>Facebook</b> app? You can also just go back there: it&apos;s already updated.
            </p>
         </div>
      </div>
   );
}
