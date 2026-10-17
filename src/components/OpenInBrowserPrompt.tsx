import { useEffect, useMemo, useRef, useState } from 'react';

import posthog from 'posthog-js';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';

import { buildAndroidIntentUrl, detectInAppBrowser, setInAppNoticeHidden } from '@/lib/inAppBrowser';
import { copyTextFromTap } from '@/lib/inAppHandoff';
import {
   handoffAddress,
   IAB_ARRIVED_PARAM,
   readContinuedHere,
   rememberContinuedHere,
   shouldShowOpenInBrowserPrompt,
   withoutArrivedTag
} from '@/lib/openInBrowserPrompt';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { RootState } from '@/store/store';

// The first screen inside Facebook's / Messenger's / Instagram's browser, before sign-up: a friendly
// "open Moodeng in Chrome (Android) / Safari (iPhone) for the best experience", or "Continue here".
// See src/lib/openInBrowserPrompt.ts. Replaces the small banner people ignored, for people not yet
// signed in. Android: the button tries Chrome at once (Facebook's browser often ignores it, so the
// ⋮ steps are right there); iPhone: there's no way to open Safari for them, so the ⋯ steps are the button.

const track = (event: string, properties: Record<string, unknown>) => {
   try {
      posthog.capture(event, properties);
   } catch {
      // Analytics unavailable — the screen works the same.
   }
};

const HIPPO = { android: '/hippos/hippo-chrome.png', ios: '/hippos/hippo-safari.png' };

export default function OpenInBrowserPrompt() {
   const location = useLocation();
   const info = useMemo(() => detectInAppBrowser(), []);
   const user = useSelector((state: RootState) => state.auth.user);
   const isAuthChecked = useSelector((state: RootState) => state.auth.isAuthChecked);
   const [enabled, setEnabled] = useState(false);
   const [continuedHere, setContinuedHere] = useState(readContinuedHere);
   const [triedChrome, setTriedChrome] = useState(false);
   const [linkCopied, setLinkCopied] = useState(false);
   // iPhone: tapping the hippo points at the ⋯ steps (there's no button that can open Safari).
   const [stepsPulse, setStepsPulse] = useState(false);
   const shownTracked = useRef(false);
   const isAndroid = info.os === 'android';
   const browser = isAndroid ? 'Chrome' : 'Safari';

   // Arrived in Chrome / Safari from this screen (?ia=1): count it, then tidy the address.
   useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get(IAB_ARRIVED_PARAM) !== '1') return;
      if (!info.isInApp) track('iab_prompt_arrived', { os: info.os, page: window.location.pathname });
      window.history.replaceState(window.history.state, '', withoutArrivedTag(window.location.href));
   }, [info]);

   // The switch, asked only inside these browsers.
   useEffect(() => {
      if (!info.isInApp) return;
      let cancelled = false;
      void Promise.resolve(getSupabaseBrowserClient().rpc('get_iab_open_prompt_enabled')).then(({ data }) => {
         if (!cancelled) setEnabled(data === true);
      });
      return () => {
         cancelled = true;
      };
   }, [info]);

   const visible =
      isAuthChecked &&
      shouldShowOpenInBrowserPrompt({ info, signedIn: Boolean(user?.id), continuedHere, enabled, pathname: location.pathname });

   // While it shows: the address carries ?ia=1 (Facebook's ⋮ / ⋯ menu opens whatever the page shows),
   // and the small "open in Chrome" banner stays out of the way.
   useEffect(() => {
      if (!visible) return undefined;
      // Once per visit: the app re-creates this screen on every page change.
      let shownBefore = shownTracked.current;
      try {
         shownBefore ||= window.sessionStorage.getItem('md_iab_prompt_shown') === '1';
         window.sessionStorage.setItem('md_iab_prompt_shown', '1');
      } catch {
         // Storage blocked: may count twice.
      }
      if (!shownBefore) track('iab_prompt_shown', { os: info.os, app: info.appName, page: location.pathname });
      shownTracked.current = true;
      const tagged = new URL(handoffAddress(window.location.href));
      window.history.replaceState(window.history.state, '', `${tagged.pathname}${tagged.search}${tagged.hash}`);
      setInAppNoticeHidden(true);
      return () => {
         window.history.replaceState(window.history.state, '', withoutArrivedTag(window.location.href));
         setInAppNoticeHidden(false);
      };
   }, [visible, info, location.pathname]);

   if (!visible) return null;

   const continueHere = () => {
      track('iab_prompt_continue', { os: info.os, app: info.appName, tried_chrome: triedChrome });
      rememberContinuedHere();
      setContinuedHere(true);
   };

   const openChrome = (via: 'button' | 'hippo' = 'button') => {
      track('iab_prompt_open_tapped', { os: info.os, app: info.appName, via });
      // Facebook's Android browser often ignores the hand-off; if we're still here, point at the ⋮ menu.
      window.setTimeout(() => {
         if (document.visibilityState === 'visible') setTriedChrome(true);
      }, 1500);
   };

   const pointAtSteps = () => {
      track('iab_prompt_hippo_tapped', { os: info.os, app: info.appName });
      setStepsPulse(true);
      window.setTimeout(() => setStepsPulse(false), 1200);
      copyLink();
   };

   const copyLink = () => {
      void copyTextFromTap(handoffAddress(window.location.href)).then((result) => {
         track('iab_prompt_link_copied', { os: info.os, ok: result.ok });
         setLinkCopied(result.ok);
      });
   };

   const menuSteps = isAndroid ? (
      <>
         Tap <b>⋮</b> at the top right, then <b>Open in Chrome</b> (or <b>Open in browser</b>).
      </>
   ) : (
      <>
         Tap <b>⋯</b> at the top right, then <b>Open in external browser</b> (or <b>Open in Safari</b>).
      </>
   );

   return (
      <div
         aria-labelledby="iab-prompt-title"
         aria-modal="true"
         className="connect-ui fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-gradient-to-b from-[#fbfafd] to-white px-4 pb-8 pt-8 dark:from-[#08040f] dark:via-[#12091f] dark:to-[#08040f]"
         role="dialog"
      >
         <div className="flex w-full max-w-[400px] flex-col items-center gap-4 text-center">
            {/* The hippo does what the main action does: people tap the picture instead of the button. */}
            {isAndroid ? (
               <a
                  aria-label="Open in Chrome"
                  href={buildAndroidIntentUrl(handoffAddress(window.location.href))}
                  onClick={() => openChrome('hippo')}
               >
                  <img alt="" className="h-36 w-auto" src={HIPPO.android} />
               </a>
            ) : (
               <button aria-label="How to open it in Safari" onClick={pointAtSteps} type="button">
                  <img alt="" className="h-36 w-auto" src={HIPPO.ios} />
               </button>
            )}
            <h1 id="iab-prompt-title" className="text-[26px] font-extrabold leading-[32px] text-[#26143f] dark:text-white">
               For the best experience, open Moodeng in {browser}
            </h1>
            <p className="text-[16px] leading-[22px] text-[#594d65] dark:text-[#c9bdd9]">
               Signing up and connecting Facebook work more smoothly there. It takes two taps.
            </p>

            {isAndroid ? (
               <a
                  className="flex min-h-[56px] w-full items-center justify-center rounded-full bg-[#6b55f7] px-4 text-[17px] font-bold text-white"
                  href={buildAndroidIntentUrl(handoffAddress(window.location.href))}
                  onClick={() => openChrome('button')}
               >
                  Open in Chrome
               </a>
            ) : null}

            <div
               className={`w-full rounded-2xl px-4 py-3 text-left text-[15px] leading-[21px] transition-transform ${stepsPulse ? 'scale-[1.04]' : ''} ${
                  isAndroid && !triedChrome
                     ? 'bg-white/70 text-[#6b5b86] dark:bg-white/5 dark:text-[#c9bdd9]'
                     : 'border-2 border-[#6b55f7] bg-white text-[#26143f] dark:bg-white/10 dark:text-white'
               }`}
            >
               <p className="font-semibold">{isAndroid ? (triedChrome ? 'Chrome didn’t open? Two taps:' : 'Or do it yourself:') : 'How to open it in Safari:'}</p>
               <p className="mt-1">{menuSteps}</p>
               <button className="mt-2 font-bold text-[#6b55f7] underline underline-offset-4" onClick={copyLink} type="button">
                  {linkCopied ? `Link copied ✓ Paste it into ${browser}` : `No menu? Copy the link for ${browser}`}
               </button>
            </div>

            <button
               className="mt-1 min-h-[48px] w-full rounded-full border-2 border-[#d9d0ee] bg-white px-4 text-[16px] font-bold text-[#594d65] dark:border-white/20 dark:bg-transparent dark:text-[#c9bdd9]"
               onClick={continueHere}
               type="button"
            >
               Continue here instead
            </button>
         </div>
      </div>
   );
}
