import type { ReactNode } from 'react';

// The "open in Safari / Chrome" guide for Facebook's / Messenger's own browser. Only the app's own menu
// (top right) can open the real browser: on iPhone nothing on the page can open Safari (Meta blocks it).
// So we show what to tap the way apps do it: small pictures of the browser's top bar with the menu
// button ringed, then the menu with "Open in external browser" ringed. They're pictures in grey frames,
// smaller than real controls, so nobody mistakes them for buttons; tapping anywhere closes it.
// Used by the first screen (OpenInBrowserPrompt) and by "Open in Safari" anywhere (SafariHelpSheet);
// public/landing/open-in-browser.js draws the same for the home page.

const RING = 'ring-[3px] ring-[#FFD43B] ring-offset-2 ring-offset-white';

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
   return (
      <div className="flex flex-col gap-2">
         <p className="flex items-center gap-2 text-[17px] font-bold leading-[22px]">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#FFD43B] text-[15px] font-black text-[#1a0f2e]">
               {n}
            </span>
            {title}
         </p>
         {/* A picture, not a control: grey frame, no pointer events. */}
         <div aria-hidden="true" className="pointer-events-none select-none rounded-2xl bg-[#2a2140] p-2.5">
            {children}
         </div>
      </div>
   );
}

export default function MenuGuide({
   os,
   chromeFailed = false,
   opensOnSignUp = false,
   onClose
}: {
   os: 'ios' | 'android';
   chromeFailed?: boolean;
   /** The first screen hands over /sign-up, so say where they'll land. */
   opensOnSignUp?: boolean;
   onClose: () => void;
}) {
   const isAndroid = os === 'android';
   const browser = isAndroid ? 'Chrome' : 'Safari';
   const menuIcon = isAndroid ? '⋮' : '⋯';
   const menuItem = isAndroid ? 'Open in Chrome' : 'Open in external browser';

   return (
      <div
         aria-labelledby="menu-guide-title"
         aria-modal="true"
         className="connect-ui fixed inset-0 z-[1002] flex flex-col items-center overflow-y-auto bg-[#120a1f] px-5 pb-6 pt-2 text-left text-white"
         onClick={onClose}
         role="dialog"
      >
         {/* The hippo looks at them and points up-right at the real menu, just above this page. */}
         <div className="flex w-full max-w-[380px] items-end justify-between gap-2">
            <p id="menu-guide-title" className="pb-2 text-[22px] font-extrabold leading-[28px]">
               {chromeFailed ? 'Chrome didn’t open? ' : ''}Open Moodeng in {browser}
            </p>
            <img alt="" className="pointer-events-none -mr-2 h-32 w-auto shrink-0" src="/hippos/hippo-point-menu.png" />
         </div>
         <div className="mt-3 flex w-full max-w-[380px] flex-col gap-4">

            <Step n={1} title={`Tap ${menuIcon} at the top right`}>
               <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-[#1c1c1e]">
                  <span className="text-[18px] leading-none">✕</span>
                  <span className="flex flex-col items-center leading-tight">
                     <span className="text-[14px] font-semibold">🔒 moodeng.app</span>
                     <span className="text-[11px] text-[#8e8e93]">Messenger</span>
                  </span>
                  <span className={`flex size-8 items-center justify-center rounded-full text-[20px] font-black leading-none ${RING}`}>
                     {menuIcon}
                  </span>
               </div>
            </Step>

            <Step n={2} title={`Tap “${menuItem}”`}>
               <div className="overflow-hidden rounded-xl bg-white text-[15px] text-[#1c1c1e]">
                  <div className="px-2 py-1.5">
                     <div className={`flex items-center gap-2 rounded-lg px-2 py-1.5 font-semibold ${RING}`}>
                        <span aria-hidden="true">{isAndroid ? '🌐' : '🧭'}</span>
                        {menuItem}
                     </div>
                  </div>
               </div>
            </Step>

            <p className="text-[14px] leading-[20px] text-white/70">
               Don&apos;t see it? It may say <b>{isAndroid ? 'Open in browser' : 'Open in Safari'}</b>.
               {opensOnSignUp ? ` ${browser} opens straight on sign-up.` : ''}
            </p>
         </div>
         <button
            className="mt-auto min-h-[48px] w-full max-w-[400px] rounded-full border-2 border-white/40 text-[16px] font-bold text-white"
            onClick={onClose}
            type="button"
         >
            Got it
         </button>
      </div>
   );
}
