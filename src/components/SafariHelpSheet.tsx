import { useEffect, useState } from 'react';

import posthog from 'posthog-js';

import { detectInAppBrowser, SAFARI_HELP_EVENT } from '@/lib/inAppBrowser';

// "Open in Safari" anywhere in the app, inside Facebook's / Messenger's / Instagram's iPhone browser:
// that browser drops the Safari link, so openInSafari copies the link and asks for this sheet with the
// two taps that do work (⋯ → Open in external browser). See openInSafari in src/lib/inAppBrowser.ts.
export default function SafariHelpSheet() {
   const [open, setOpen] = useState<{ copied: boolean } | null>(null);

   useEffect(() => {
      const onHelp = (event: Event) => {
         const detail = (event as CustomEvent<{ copied?: boolean }>).detail ?? {};
         setOpen({ copied: Boolean(detail.copied) });
         try {
            posthog.capture('safari_help_shown', { app: detectInAppBrowser().appName, copied: Boolean(detail.copied), page: window.location.pathname });
         } catch {
            // Analytics unavailable.
         }
      };
      window.addEventListener(SAFARI_HELP_EVENT, onHelp);
      return () => window.removeEventListener(SAFARI_HELP_EVENT, onHelp);
   }, []);

   if (!open) return null;

   return (
      <div
         aria-labelledby="safari-help-title"
         aria-modal="true"
         className="fixed inset-0 z-[1001] flex items-end justify-center bg-black/40"
         onClick={() => setOpen(null)}
         role="dialog"
      >
         <div
            className="connect-ui w-full max-w-[440px] rounded-t-[24px] bg-white px-5 pb-8 pt-5 text-center dark:bg-[#12091f]"
            onClick={(event) => event.stopPropagation()}
         >
            <img alt="" className="mx-auto h-28 w-auto" src="/hippos/hippo-safari.png" />
            <h2 id="safari-help-title" className="mt-2 text-[22px] font-extrabold leading-[28px] text-[#26143f] dark:text-white">
               Open Moodeng in Safari
            </h2>
            <p className="mt-3 rounded-2xl border-2 border-[#6b55f7] px-4 py-3 text-left text-[16px] leading-[22px] text-[#26143f] dark:text-white">
               Tap <b>⋯</b> at the top right, then <b>Open in external browser</b> (or <b>Open in Safari</b>).
            </p>
            {open.copied ? (
               <p className="mt-3 text-[15px] leading-[21px] text-[#594d65] dark:text-[#c9bdd9]">
                  No menu? The link is copied: open Safari and paste it in the address bar.
               </p>
            ) : null}
            <button
               className="mt-4 min-h-[48px] w-full rounded-full border-2 border-[#d9d0ee] bg-white text-[16px] font-bold text-[#594d65] dark:border-white/20 dark:bg-transparent dark:text-[#c9bdd9]"
               onClick={() => setOpen(null)}
               type="button"
            >
               Got it
            </button>
         </div>
      </div>
   );
}
