import { useEffect, useRef } from 'react';

import posthog from 'posthog-js';
import { useSelector } from 'react-redux';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { usePreKycGate } from '@/hooks/usePreKycGate';
import { getSignedInReturnPath } from '@/hooks/useSignedInRedirect';

import { detectInAppBrowser } from '@/lib/inAppBrowser';
import type { RootState } from '@/store/store';

// moodeng.app/continue — "pick up where you left off". The Messenger bot links here after it confirms a
// borrower who signed up inside Facebook's / Messenger's browser (sendpulse-messenger-verify), and the home
// page links here when this browser is still signed in (public/landing/site.js). On iPhone, Messenger's
// browser is thrown away when they close it to paste their code, so this is their way back.
//   * Signed in here: straight on to their next step (same rule as /sign-in for signed-in people).
//   * Not signed in: this is a different browser from the one they started in (Messenger's vs Facebook's,
//     or Safari). Guest accounts can't sign in again, so point them back to where they started.

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

   useEffect(() => {
      if (!settled || tracked.current) return;
      tracked.current = true;
      const info = detectInAppBrowser();
      track('continue_opened', { signed_in: signedIn, via, in_app: info.isInApp, app: info.appName, os: info.os });
   }, [settled, signedIn, via]);

   useEffect(() => {
      if (!settled || !signedIn || gate.isLoading) return;
      let cancelled = false;
      void getSignedInReturnPath(user, gate.isGated)
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
            <h1 className="text-[24px] font-extrabold leading-[30px] text-[#26143f]">Go back to where you started</h1>
            <p className="text-[16px] leading-[22px] text-[#594d65]">
               You&apos;re not signed in on this screen. If you started Moodeng in the <b>Facebook</b> app, go back there: your page is
               already updated.
            </p>
            <p className="text-[15px] leading-[21px] text-[#877897]">
               On iPhone, swipe right along the bottom edge of the screen to switch back to the app you were using.
            </p>
            <Link
               className="mt-2 flex min-h-[52px] w-full items-center justify-center rounded-full bg-[#6b55f7] px-4 text-[16px] font-bold text-white"
               onClick={() => track('continue_sign_in_tapped', { via })}
               to="/sign-in"
            >
               Sign in here instead
            </Link>
         </div>
      </div>
   );
}
