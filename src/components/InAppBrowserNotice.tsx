import { type JSX, useEffect, useRef, useState } from 'react';

import posthog from 'posthog-js';

import AskSupportButton from '@/components/support/AskSupportButton';

import {
   buildAndroidIntentUrl,
   detectInAppBrowser,
   type InAppBrowserInfo,
   openInSafari,
   watchForFailedHandOff,
   watchInAppNoticeHidden
} from '@/lib/inAppBrowser';

const DISMISS_KEY = 'moodeng_inapp_notice_dismissed';

function wasDismissed(): boolean {
   try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
   } catch {
      return false;
   }
}

function track(event: string, info: InAppBrowserInfo, extra: Record<string, unknown> = {}): void {
   if (!import.meta.env.PROD) return;
   posthog.capture(event, { app: info.appName ?? 'unknown', os: info.os, page: window.location.pathname, ...extra });
}

function copyText(text: string): Promise<boolean> {
   if (!navigator.clipboard?.writeText) return Promise.resolve(false);
   return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => false);
}

function rememberDismissed(): void {
   try {
      sessionStorage.setItem(DISMISS_KEY, '1');
   } catch {
      /* sessionStorage can be unavailable (private mode / blocked storage) — ignore */
   }
}

/**
 * Global, mounted once at the app root. When the page is running inside a social/messaging
 * in-app browser (Messenger, Facebook, Instagram, LINE…), Google sign-in and wallet
 * connections silently fail. This shows a dismissable notice that gets the user into their
 * real browser — one tap on Android (Chrome intent), guided instructions on iOS.
 */
export default function InAppBrowserNotice(): JSX.Element | null {
   const [info, setInfo] = useState<InAppBrowserInfo | null>(null);
   const [dismissed, setDismissed] = useState(false);
   // Hidden while a screen shows its own help for this (see setInAppNoticeHidden).
   const [hiddenByScreen, setHiddenByScreen] = useState(false);
   const [copied, setCopied] = useState(false);
   // Android only: we tried to hand off to Chrome and the page is still here (Facebook's in-app
   // browser ignores the intent link). Switch to step-by-step "⋮ → Open in Chrome" instructions.
   const [handOffFailed, setHandOffFailed] = useState(false);
   // The "Tap ⋮ up here" pointer sits over the top-right corner (Help / Home on the dashboard), so it
   // only shows for a few seconds; the steps in the card stay.
   const [showPointer, setShowPointer] = useState(false);
   const stopWatchingRef = useRef<(() => void) | null>(null);

   useEffect(() => {
      if (!showPointer) return;
      const timer = window.setTimeout(() => setShowPointer(false), 6000);
      return () => window.clearTimeout(timer);
   }, [showPointer]);

   // Detect on the client only (user-agent isn't meaningful during SSR/build).
   useEffect(() => {
      setInfo(detectInAppBrowser());
      setDismissed(wasDismissed());
      const unwatch = watchInAppNoticeHidden(setHiddenByScreen);
      return () => {
         unwatch();
         stopWatchingRef.current?.();
      };
   }, []);

   const visible = Boolean(info?.isInApp) && !dismissed && !hiddenByScreen;

   // How many people see the "Open in Chrome/Safari" notice and how many close it — once per page load.
   const shownTrackedRef = useRef(false);
   useEffect(() => {
      if (!visible || !info || shownTrackedRef.current) return;
      shownTrackedRef.current = true;
      track('inapp_notice_shown', info);
   }, [visible, info]);

   if (!info?.isInApp || dismissed || hiddenByScreen) return null;

   const appLabel = info.appName ?? 'this app';

   const handleDismiss = () => {
      track('inapp_notice_dismissed', info, { after_failed_handoff: handOffFailed });
      rememberDismissed();
      setDismissed(true);
   };

   const flashCopied = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
   };

   const handleCopy = () => {
      void copyText(window.location.href).then((ok) => {
         if (ok) flashCopied();
      });
   };

   const handleOpen = () => {
      const url = window.location.href;
      if (info.canBreakOut) {
         track('inapp_open_tapped', info, { method: 'link' });
         // Copy now, while we still have the tap: if Chrome doesn't open, the link is ready to paste.
         // The hand-off itself is the button's own href (see below), not a script redirect.
         void copyText(url);
         stopWatchingRef.current?.();
         stopWatchingRef.current = watchForFailedHandOff(() => {
            setHandOffFailed(true);
            setShowPointer(true);
            track('inapp_open_failed', info);
         });
         return;
      }
      // iOS / unforceable: copy the link so they can paste it into Safari.
      handleCopy();
   };

   if (handOffFailed) {
      return (
         <>
            {/* Points at the in-app browser's own ⋮ menu, which sits just above the page, top right. */}
            {showPointer ? (
               <div
                  className="pointer-events-none fixed right-2 top-1 z-[9999] flex flex-col items-end motion-safe:animate-bounce"
                  aria-hidden="true"
               >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="mr-2">
                     <path d="M12 20V5m0 0-6 6m6-6 6 6" stroke="#6c3fe0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="rounded-full bg-[#6c3fe0] px-3 py-1 text-[13px] font-semibold text-white shadow-lg">Tap ⋮ up here</span>
               </div>
            ) : null}
            <div
               role="dialog"
               aria-label="Open Moodeng in Chrome"
               className="fixed inset-x-3 bottom-3 z-[9999] mx-auto max-w-md rounded-2xl border border-[#e6ddf6] bg-white p-4 shadow-[0_10px_40px_rgba(27,10,54,0.22)] dark:border-[#40354F] dark:bg-[#17121F]"
            >
               <div className="flex items-start justify-between gap-3">
                  <p className="text-[15px] font-semibold leading-tight text-[#1b0a36] dark:text-[#F8F4FF]">
                     {appLabel} blocked Chrome. Two taps to fix it:
                  </p>
                  <button
                     type="button"
                     onClick={handleDismiss}
                     aria-label="Dismiss"
                     className="-mr-1 -mt-1 shrink-0 rounded-full p-1 text-[#9a8fb0] transition-colors hover:bg-[#f3effe] hover:text-[#5b5470] dark:hover:bg-[#281b35]"
                  >
                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                     </svg>
                  </button>
               </div>
               <ol className="mt-3 flex flex-col gap-2.5">
                  <li className="flex items-center gap-3">
                     <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#6c3fe0] text-[14px] font-bold text-white">
                        1
                     </span>
                     <span className="text-[14px] leading-snug text-[#3b3350] dark:text-[#D8CEE6]">
                        Tap{' '}
                        <span className="rounded-md bg-[#f3effe] px-1.5 py-0.5 font-bold text-[#1b0a36] dark:bg-[#281b35] dark:text-[#F8F4FF]">
                           ⋮
                        </span>{' '}
                        at the top right of the screen
                     </span>
                  </li>
                  <li className="flex items-center gap-3">
                     <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#6c3fe0] text-[14px] font-bold text-white">
                        2
                     </span>
                     <span className="text-[14px] leading-snug text-[#3b3350] dark:text-[#D8CEE6]">
                        Choose <span className="font-semibold">Open in Chrome</span> or{' '}
                        <span className="font-semibold">Open in external browser</span>
                     </span>
                  </li>
               </ol>
               <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#faf8ff] p-2.5 dark:bg-[#1f1830]">
                  <p className="min-w-0 flex-1 text-[13px] leading-snug text-[#5b5470] dark:text-[#B5ACBE]">
                     No menu? Copy the link and paste it into Chrome.
                  </p>
                  <button
                     type="button"
                     onClick={handleCopy}
                     className="shrink-0 rounded-xl bg-[#6c3fe0] px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-95"
                  >
                     {copied ? 'Copied ✓' : 'Copy link'}
                  </button>
               </div>
               <div className="mt-2.5">
                  <AskSupportButton
                     variant="link"
                     label="Still stuck? Message support"
                     context={{ page: 'In-app browser notice', step: 'in-app-browser-handoff-failed' }}
                     topic={`Opened Moodeng inside ${appLabel} — "Open in Chrome" didn't work`}
                  />
               </div>
            </div>
         </>
      );
   }

   const primaryLabel = info.canBreakOut ? 'Open in Chrome' : copied ? 'Link copied ✓' : 'Copy link';

   return (
      <div
         role="dialog"
         aria-label="Open in your browser"
         className="fixed inset-x-3 bottom-3 z-[9999] mx-auto max-w-md rounded-2xl border border-[#e6ddf6] bg-white p-4 shadow-[0_10px_40px_rgba(27,10,54,0.22)] dark:border-[#40354F] dark:bg-[#17121F]"
      >
         <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f3effe] dark:bg-[#281b35]">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                     d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6m0 0v6m0-6L10 14"
                     stroke="#6c3fe0"
                     strokeWidth="2"
                     strokeLinecap="round"
                     strokeLinejoin="round"
                  />
               </svg>
            </div>
            <div className="min-w-0 flex-1">
               <p className="text-[15px] font-semibold leading-tight text-[#1b0a36] dark:text-[#F8F4FF]">Open Moodeng in your browser</p>
               <p className="mt-1 text-[13px] leading-snug text-[#5b5470] dark:text-[#B5ACBE]">
                  {info.canBreakOut ? (
                     <>Google sign-in and wallet payments don&apos;t work inside {appLabel}. Tap below to continue in Chrome.</>
                  ) : (
                     <>
                        Sign-in doesn&apos;t stay saved and wallet payments don&apos;t work inside {appLabel}. Tap{' '}
                        <span className="font-semibold">•••</span> at the top, choose <span className="font-semibold">Open in Browser</span>
                        , or use a button below.
                     </>
                  )}
               </p>
               <div className="mt-3 flex items-center gap-2">
                  {info.canBreakOut ? (
                     // A real link the person taps. Facebook's Android browser ignored the old script
                     // redirect to this intent:// URL (11 of 30 tapped Sept–Oct 2026, 1 reached Chrome);
                     // WebViews hand a tapped intent:// link to Android far more often than a scripted one.
                     <a
                        href={buildAndroidIntentUrl(window.location.href)}
                        onClick={handleOpen}
                        className="rounded-xl bg-[#6c3fe0] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-95"
                     >
                        {primaryLabel}
                     </a>
                  ) : (
                     <button
                        type="button"
                        onClick={handleOpen}
                        className="rounded-xl bg-[#6c3fe0] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-95"
                     >
                        {primaryLabel}
                     </button>
                  )}
                  {info.os === 'ios' ? (
                     <button
                        type="button"
                        onClick={() => openInSafari(window.location.href, info)}
                        className="rounded-xl border border-[#d9cff0] px-3 py-2 text-sm font-semibold text-[#6c3fe0] dark:border-[#40354F] dark:text-[#C9B6FF]"
                     >
                        Open in Safari
                     </button>
                  ) : null}
                  <button
                     type="button"
                     onClick={handleDismiss}
                     className="rounded-xl px-3 py-2 text-sm font-medium text-[#5b5470] transition-colors hover:bg-[#f3effe] dark:text-[#B5ACBE] dark:hover:bg-[#281b35]"
                  >
                     Not now
                  </button>
               </div>
               <div className="mt-2.5">
                  <AskSupportButton
                     variant="link"
                     label="Why isn't this working?"
                     context={{ page: 'In-app browser notice', step: 'in-app-browser' }}
                     topic={`Opened Moodeng inside ${appLabel} — sign-in / wallet not working`}
                  />
               </div>
            </div>
            <button
               type="button"
               onClick={handleDismiss}
               aria-label="Dismiss"
               className="-mr-1 -mt-1 shrink-0 rounded-full p-1 text-[#9a8fb0] transition-colors hover:bg-[#f3effe] hover:text-[#5b5470] dark:hover:bg-[#281b35]"
            >
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
               </svg>
            </button>
         </div>
      </div>
   );
}
