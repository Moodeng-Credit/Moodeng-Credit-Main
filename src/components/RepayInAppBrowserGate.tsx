import { type JSX, useState } from 'react';

import AskSupportButton from '@/components/support/AskSupportButton';

import { type InAppBrowserInfo, openInChrome, openInSafari } from '@/lib/inAppBrowser';

// The canonical repay URL to hand to the real browser. Kept explicit (not window.location) so the
// copied/opened link is always the clean repay page, even if the current URL carries query junk.
const REPAY_URL = 'https://moodeng.app/repay';

/**
 * Shown ON the repay screen when a Base-Account borrower is inside a Facebook / in-app browser,
 * where the Base wallet's popup + passkey handshake can't complete — the dead "Sending payment…"
 * spinner. It replaces the doomed repay form with a purposeful escape hatch: copy the repay link
 * and open it in a real browser (Chrome / Safari). See [[inAppBrowser]].
 *
 * Honest limits (drive the UI): Chrome opens fairly reliably (Android intent / iOS
 * googlechromes://); Safari CANNOT be force-opened from an iOS webview, so its button is
 * best-effort and the copy-link + "tap ••• → Open in Browser" path is the reliable one. Android
 * has no Safari, so that button is hidden there.
 */
export default function RepayInAppBrowserGate({
   info,
   targetUrl = REPAY_URL
}: {
   info: InAppBrowserInfo;
   targetUrl?: string;
}): JSX.Element {
   const [copied, setCopied] = useState(false);
   const appLabel = info.appName ?? 'this app';
   const showSafari = info.os === 'ios';

   const handleCopy = () => {
      void navigator.clipboard
         ?.writeText(targetUrl)
         .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2200);
         })
         .catch(() => setCopied(false));
   };

   return (
      <section
         role="dialog"
         aria-label="Open Moodeng in your browser to repay"
         className="mx-auto w-full max-w-[440px] rounded-[24px] bg-white px-6 py-7 shadow-[0_18px_50px_rgba(44,19,82,0.12)] dark:bg-[#17121F]"
      >
         <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-[#EFE7FF] text-[#8336F0] dark:bg-[#281b35]">
            <i className="fas fa-arrow-up-right-from-square text-xl" aria-hidden="true" />
         </div>

         <h1 className="text-center text-[1.5rem] font-semibold leading-tight tracking-[-0.03em] text-[#040033] dark:text-[#F8F4FF]">
            Finish repaying in your browser
         </h1>
         <p className="mt-3 text-center text-[15px] leading-6 text-[#5F536D] dark:text-[#B5ACBE]">
            {appLabel}&apos;s in-app browser can&apos;t open your wallet, so a repayment gets stuck here. Open this page in
            Chrome or Safari to pay — it only takes a few seconds.
         </p>

         {/* Copy-link box — the always-works path: copy → open your browser → paste. */}
         <div className="mt-5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.06em] text-[#8336F0]">Your repay link</p>
            <div className="flex items-center gap-2 rounded-2xl border border-[#e6ddf6] bg-[#faf8ff] px-3 py-2 dark:border-[#40354F] dark:bg-[#1f1830]">
               <span className="min-w-0 flex-1 truncate text-sm text-[#40354F] dark:text-[#D8CEE6]">{targetUrl}</span>
               <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 rounded-xl bg-[#6c3fe0] px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-95"
               >
                  {copied ? 'Copied ✓' : 'Copy'}
               </button>
            </div>
         </div>

         {/* Direct-open buttons — best-effort deep links into the real browser. */}
         <div className="mt-4 flex flex-col gap-2">
            <button
               type="button"
               onClick={() => openInChrome(targetUrl, info)}
               className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#16A34A] px-4 text-base font-semibold text-white transition-opacity hover:opacity-95"
            >
               <i className="fab fa-chrome text-lg" aria-hidden="true" />
               Open in Chrome
            </button>
            {showSafari && (
               <button
                  type="button"
                  onClick={() => openInSafari(targetUrl, info)}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#0b74e5] px-4 text-base font-semibold text-white transition-opacity hover:opacity-95"
               >
                  <i className="fab fa-safari text-lg" aria-hidden="true" />
                  Open in Safari
               </button>
            )}
         </div>

         <p className="mt-3 text-center text-[13px] leading-snug text-[#8a7fa0] dark:text-[#9a8fb0]">
            If a button doesn&apos;t open your browser, tap <span className="font-semibold">•••</span> at the top of {appLabel}
            and choose <span className="font-semibold">Open in Browser</span>, then paste the link.
         </p>

         <div className="mt-4 text-center">
            <AskSupportButton
               variant="link"
               label="Still stuck? Message support"
               context={{ page: 'Repay', step: 'in-app-browser-gate' }}
               topic={`Can't repay inside ${appLabel} — needs to open in a real browser`}
            />
         </div>
      </section>
   );
}
