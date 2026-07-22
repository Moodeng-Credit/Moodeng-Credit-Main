import { type JSX, useEffect, useState } from 'react';

import AskMechaButton from '@/components/mecha/AskMechaButton';

import { detectInAppBrowser, openInSystemBrowser, type InAppBrowserInfo } from '@/lib/inAppBrowser';

const DISMISS_KEY = 'moodeng_inapp_notice_dismissed';

function wasDismissed(): boolean {
   try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
   } catch {
      return false;
   }
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
   const [copied, setCopied] = useState(false);

   // Detect on the client only (user-agent isn't meaningful during SSR/build).
   useEffect(() => {
      setInfo(detectInAppBrowser());
      setDismissed(wasDismissed());
   }, []);

   if (!info?.isInApp || dismissed) return null;

   const appLabel = info.appName ?? 'this app';

   const handleDismiss = () => {
      rememberDismissed();
      setDismissed(true);
   };

   const handleOpen = () => {
      const url = window.location.href;
      if (info.canBreakOut) {
         openInSystemBrowser(url, info);
         return;
      }
      // iOS / unforceable: copy the link so they can paste it into Safari.
      void navigator.clipboard
         ?.writeText(url)
         .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2200);
         })
         .catch(() => setCopied(false));
   };

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
               <p className="text-[15px] font-semibold leading-tight text-[#1b0a36] dark:text-[#F8F4FF]">
                  Open Moodeng in your browser
               </p>
               <p className="mt-1 text-[13px] leading-snug text-[#5b5470] dark:text-[#B5ACBE]">
                  {info.canBreakOut ? (
                     <>Sign-in with Google doesn&apos;t work inside {appLabel}. Tap below to continue in Chrome.</>
                  ) : (
                     <>
                        Sign-in with Google doesn&apos;t work inside {appLabel}. Tap <span className="font-semibold">•••</span> at
                        the top, choose <span className="font-semibold">Open in Browser</span>, or copy the link below.
                     </>
                  )}
               </p>
               <div className="mt-3 flex items-center gap-2">
                  <button
                     type="button"
                     onClick={handleOpen}
                     className="rounded-xl bg-[#6c3fe0] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-95"
                  >
                     {primaryLabel}
                  </button>
                  <button
                     type="button"
                     onClick={handleDismiss}
                     className="rounded-xl px-3 py-2 text-sm font-medium text-[#5b5470] transition-colors hover:bg-[#f3effe] dark:text-[#B5ACBE] dark:hover:bg-[#281b35]"
                  >
                     Not now
                  </button>
               </div>
               <div className="mt-2.5">
                  <AskMechaButton
                     variant="link"
                     label="Why isn't this working?"
                     context={{ page: 'In-app browser notice', step: 'in-app-browser' }}
                     seedUserMessage={`I opened Moodeng inside ${appLabel} and sign-in / my wallet won't work. What should I do?`}
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
