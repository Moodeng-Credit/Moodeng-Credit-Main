import { type JSX, useCallback, useEffect, useState } from 'react';

import { useLocation } from 'react-router-dom';

import AskMechaButton from '@/components/mecha/AskMechaButton';

import { checkCoinbaseKeysReachability, clearCoinbaseKeysReachabilityCache } from '@/lib/coinbaseReachability';
import { detectInAppBrowser } from '@/lib/inAppBrowser';

const DISMISS_KEY = 'moodeng_network_block_notice_dismissed';

// The surfaces that open the keys.coinbase.com popup: wallet connect, repay, withdraw (plus
// their -preview variants). Mounted once globally but only probes/shows on these routes so we
// don't hit keys.coinbase.com from every page.
const WALLET_SIGNING_ROUTE = /^\/(onboarding\/wallet|repay|withdraw)/;

// Cloudflare's "1.1.1.1" app tunnels DNS (and, with WARP on, all traffic) around an ISP's
// block — it fixes both the DNS-hijack and any deeper SNI/IP filtering, on WiFi and cellular.
const ONE_ONE_ONE_ONE_LINK: Record<'ios' | 'android' | 'other', string> = {
   ios: 'https://apps.apple.com/app/1-1-1-1-faster-internet/id1423538627',
   android: 'https://play.google.com/store/apps/details?id=com.cloudflare.onedotonedotonedotone',
   other: 'https://one.one.one.one/'
};

type Status = 'checking' | 'reachable' | 'blocked' | 'unknown';

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
      /* sessionStorage can be unavailable — ignore */
   }
}

// In dev, `?netblock=1` forces the card on (and `?netblock=0` forces it off) so the blocked
// state is reviewable without being on a censored network.
function devOverride(): Status | null {
   if (!import.meta.env.DEV || typeof window === 'undefined') return null;
   const flag = new URLSearchParams(window.location.search).get('netblock');
   if (flag === '1') return 'blocked';
   if (flag === '0') return 'reachable';
   return null;
}

/**
 * Shown on wallet-connect surfaces. When the Base Account sign-in host (keys.coinbase.com) is
 * unreachable — typically an ISP (PLDT/Smart in the Philippines) blocking it — the Base Account
 * popup opens to a dead white screen and connect silently fails. This turns that dead end into a
 * 30-second fix: install Cloudflare's free 1.1.1.1 app, switch it on, reconnect.
 */
export default function WalletNetworkBlockNotice(): JSX.Element | null {
   const [status, setStatus] = useState<Status>('checking');
   const [dismissed, setDismissed] = useState(false);
   const [rechecking, setRechecking] = useState(false);
   const location = useLocation();
   const onSigningRoute = WALLET_SIGNING_ROUTE.test(location.pathname);

   // Probe only once the user reaches a wallet-signing route. The result is session-cached, so
   // re-entering another signing route is a cheap cache read, not a fresh network hit.
   useEffect(() => {
      if (!onSigningRoute) return;
      const forced = devOverride();
      if (forced) {
         setStatus(forced);
         return;
      }
      let active = true;
      void checkCoinbaseKeysReachability().then((result) => {
         if (active) setStatus(result);
      });
      return () => {
         active = false;
      };
   }, [onSigningRoute]);

   useEffect(() => {
      setDismissed(wasDismissed());
   }, []);

   const handleRetry = useCallback(() => {
      if (devOverride()) return;
      clearCoinbaseKeysReachabilityCache();
      // Keep `status` at 'blocked' so the card stays visible while we re-probe; only swap in the
      // fresh result when it lands (a 'reachable' result then hides the card on its own).
      setRechecking(true);
      void checkCoinbaseKeysReachability(true).then((result) => {
         setStatus(result);
         setRechecking(false);
      });
   }, []);

   const handleDismiss = useCallback(() => {
      rememberDismissed();
      setDismissed(true);
   }, []);

   if (!onSigningRoute || status !== 'blocked' || dismissed) return null;

   const os = detectInAppBrowser().os;
   const appLink = ONE_ONE_ONE_ONE_LINK[os];

   return (
      <div
         role="dialog"
         aria-label="Network is blocking wallet sign-in"
         className="fixed inset-x-3 bottom-3 z-[9999] mx-auto max-w-md rounded-2xl border border-[#e6ddf6] bg-white p-4 shadow-[0_10px_40px_rgba(27,10,54,0.22)] dark:border-[#40354F] dark:bg-[#17121F]"
      >
         <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f3effe] dark:bg-[#281b35]">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                     d="M2 8.5C7.5 4 16.5 4 22 8.5M5 12c4-3.2 10-3.2 14 0M8.5 15.5c2-1.6 5-1.6 7 0M12 19h.01M3 3l18 18"
                     stroke="#6c3fe0"
                     strokeWidth="2"
                     strokeLinecap="round"
                     strokeLinejoin="round"
                  />
               </svg>
            </div>
            <div className="min-w-0 flex-1">
               <p className="text-[15px] font-semibold leading-tight text-[#1b0a36] dark:text-[#F8F4FF]">
                  Trouble connecting? Your network may be blocking it
               </p>
               <p className="mt-1 text-[13px] leading-snug text-[#5b5470] dark:text-[#B5ACBE]">
                  Some networks (PLDT / Smart) block the Base sign-in page, so the wallet screen won&apos;t load. The free{' '}
                  <span className="font-semibold">1.1.1.1</span> app fixes it — install it, switch it on, then reconnect. It works
                  on WiFi and mobile data.
               </p>
               <div className="mt-3 flex flex-wrap items-center gap-2">
                  <a
                     href={appLink}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="rounded-xl bg-[#6c3fe0] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-95"
                  >
                     Get the free 1.1.1.1 app
                  </a>
                  <button
                     type="button"
                     onClick={handleRetry}
                     disabled={rechecking}
                     className="rounded-xl px-3 py-2 text-sm font-medium text-[#6c3fe0] transition-colors hover:bg-[#f3effe] disabled:opacity-60 dark:text-[#c3a9ff] dark:hover:bg-[#281b35]"
                  >
                     {rechecking ? 'Checking…' : "I've turned it on — Retry"}
                  </button>
               </div>
               <div className="mt-2.5">
                  <AskMechaButton
                     variant="link"
                     label="Still stuck? Ask Mecha"
                     context={{ page: 'Wallet network block notice', step: 'network-block' }}
                     seedUserMessage="My wallet won't connect — the sign-in screen is blank or shows a security warning. What should I do?"
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
