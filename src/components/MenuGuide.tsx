import { type ReactNode, useState } from 'react';

import { RING, TAP_KEYFRAMES } from '@/components/guideStyles';
import { metaIosHost } from '@/lib/inAppBrowser';
import { copyTextFromTap } from '@/lib/inAppHandoff';

// The "open in Safari / Chrome" guide for Facebook's / Messenger's own browser. Only the app's own menu
// (top right) can open the real browser: on iPhone nothing on the page can open Safari (Meta blocks it).
// So we show what to tap the way apps do it: small pictures of the browser's top bar with the menu
// button ringed, then the menu with "Open in external browser" ringed. They're pictures in grey frames,
// smaller than real controls, so nobody mistakes them for buttons; tapping anywhere closes it.
// Used by the first screen (OpenInBrowserPrompt) and by "Open in Safari" anywhere (SafariHelpSheet);
// public/landing/open-in-browser.js draws the same for the home page.

// A finger that taps the spot, with a ripple, so "tap" is obvious (George, 18 Oct: people asked
// "tap what?"). Placed with its fingertip at (left, top) of the parent, which must be `relative`.
export function TapFinger({ left, top }: { left: string; top: string }) {
   return (
      <span aria-hidden="true" className="pointer-events-none absolute z-10" style={{ left, top }}>
         <span
            className="mg-ripple absolute left-0 top-0 size-10 rounded-full border-[3px] border-[#FFD43B]"
            style={{ animation: 'mg-ripple 1.6s ease-out infinite' }}
         />
         <span
            className="mg-finger absolute -left-[15px] -top-[3px] block text-[34px] leading-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]"
            style={{ animation: 'mg-tap 1.6s ease-in-out infinite' }}
         >
            👆
         </span>
      </span>
   );
}

export function Step({ n, title, children }: { n: number; title: string; children?: ReactNode }) {
   return (
      <div className="flex flex-col gap-2">
         <p className="flex items-center gap-2 text-[17px] font-bold leading-[22px]">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#FFD43B] text-[15px] font-black text-[#1a0f2e]">
               {n}
            </span>
            {title}
         </p>
         {/* A picture, not a control: grey frame, no pointer events. */}
         {children ? (
            <div aria-hidden="true" className="pointer-events-none select-none rounded-2xl bg-[#2a2140] p-2.5">
               {children}
            </div>
         ) : null}
      </div>
   );
}

export default function MenuGuide({
   os,
   chromeFailed = false,
   opensOnSignUp = false,
   linkCopied = null,
   link,
   onClose
}: {
   os: 'ios' | 'android';
   chromeFailed?: boolean;
   /** Whether the button that opened this copied the page link (null: it didn't try, or hasn't finished). */
   linkCopied?: boolean | null;
   /** The page link. When the automatic copy failed, it's shown with a "Copy link" button. */
   link?: string;
   /** The first screen hands over /sign-up, so say where they'll land. */
   opensOnSignUp?: boolean;
   onClose: () => void;
}) {
   const isAndroid = os === 'android';
   const browser = isAndroid ? 'Chrome' : 'Safari';
   const menuIcon = isAndroid ? '⋮' : '⋯';
   const menuItem = isAndroid ? 'Open in Chrome' : 'Open in external browser';
   // iPhone in the Facebook app (not Messenger): its menu isn't the Messenger one in the screenshot, so
   // it gets the drawn menu item instead, and its own name under the address. Messenger is unchanged.
   const fbAppIos = !isAndroid && metaIosHost() === 'facebook';
   // The automatic copy can be refused; a tap of their own almost always copies. If even that fails,
   // the link is selectable so they can press and hold it.
   const [tapCopy, setTapCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
   const copied = linkCopied === true || tapCopy === 'copied';
   const copyFromTap = () => {
      if (!link) return;
      void copyTextFromTap(link).then((result) => setTapCopy(result.ok ? 'copied' : 'failed'));
   };

   return (
      <div
         aria-labelledby="menu-guide-title"
         aria-modal="true"
         className="connect-ui fixed inset-0 z-[1002] flex flex-col items-center overflow-y-auto bg-[#120a1f] px-5 pb-6 pt-2 text-left text-white"
         onClick={onClose}
         role="dialog"
      >
         <style>{TAP_KEYFRAMES}</style>
         {/* The hippo looks at them and points up-right at the real menu, just above this page. */}
         <div className="flex w-full max-w-[380px] items-end justify-between gap-2">
            <p id="menu-guide-title" className="pb-2 text-[22px] font-extrabold leading-[28px]">
               {chromeFailed ? 'Chrome didn’t open? ' : ''}Open Moodeng in {browser}
            </p>
            <img alt="" className="pointer-events-none mr-12 h-32 w-auto shrink-0" src="/hippos/hippo-point-menu.png" />
         </div>
         <div className="mt-3 flex w-full max-w-[380px] flex-col gap-4">
            {/* Their tap already copied the link (or couldn't): say so first, before the menu pictures. Plain
                text, not a card, and the one real button is purple like the app's own buttons, so it can't be
                mistaken for the pictures below (George, 20 Oct). */}
            {copied ? (
               <div role="status">
                  <p className="text-[17px] font-bold leading-[22px] text-[#7CE38B]">✓ Link copied</p>
                  <p className="text-[14px] leading-[20px] text-white/70">{`If ${browser} opens without Moodeng, paste it in the address bar.`}</p>
               </div>
            ) : linkCopied === false && link ? (
               // Tapping here mustn't close the guide (the backdrop closes it).
               <div className="flex flex-col gap-1.5" onClick={(event) => event.stopPropagation()}>
                  <button
                     className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#6b55f7] px-4 text-[17px] font-bold text-white"
                     onClick={copyFromTap}
                     type="button"
                  >
                     <span aria-hidden="true">📋</span>
                     Copy link
                  </button>
                  {tapCopy === 'failed' ? (
                     <>
                        <p className="text-[14px] leading-[20px] text-white/80" role="status">
                           Couldn&apos;t copy. Press and hold the link, then tap Copy.
                        </p>
                        <p className="select-all break-all text-[14px] leading-[20px] text-white underline">{link}</p>
                     </>
                  ) : (
                     <p className="text-center text-[14px] leading-[20px] text-white/70">{`So you can paste it if ${browser} opens without Moodeng.`}</p>
                  )}
               </div>
            ) : null}

            <Step n={1} title={`Tap ${menuIcon} at the top right`}>
               <div className="relative flex items-center justify-between rounded-xl bg-white px-3 py-2 text-[#1c1c1e]">
                  <span className="text-[18px] leading-none">✕</span>
                  <span className="flex flex-col items-center leading-tight">
                     <span className="text-[14px] font-semibold">🔒 moodeng.app</span>
                     <span className="text-[11px] text-[#8e8e93]">{fbAppIos ? 'Facebook' : 'Messenger'}</span>
                  </span>
                  <span className={`flex size-8 items-center justify-center rounded-full text-[20px] font-black leading-none ${RING}`}>
                     {menuIcon}
                  </span>
                  <TapFinger left="calc(100% - 28px)" top="50%" />
               </div>
            </Step>

            <Step n={2} title={isAndroid ? `Tap “${menuItem}”` : `Tap “${menuItem}”`}>
               {fbAppIos ? (
                  // Drawn like the Messenger screenshot below (dark sheet, the rest faded, the one to tap
                  // ringed) until we have a picture of the Facebook app's own menu.
                  <div className="relative rounded-xl bg-[#1c1c1e] px-2 py-2 text-[15px] text-white">
                     {[0, 1].map((row) => (
                        <div className="flex items-center gap-3 px-2 py-2.5 opacity-30" key={`top-${row}`}>
                           <span className="size-5 rounded-full bg-white/60" />
                           <span className="h-2.5 w-28 rounded-full bg-white/60" />
                        </div>
                     ))}
                     <div className={`flex items-center gap-3 rounded-lg px-2 py-2 font-semibold ${RING.replace('ring-offset-white', 'ring-offset-[#1c1c1e]')}`}>
                        <span className="flex size-5 items-center justify-center rounded bg-white text-[13px] font-black leading-none text-[#1c1c1e]">↗</span>
                        {menuItem}
                     </div>
                     <div className="flex items-center gap-3 px-2 py-2.5 opacity-30">
                        <span className="size-5 rounded-full bg-white/60" />
                        <span className="h-2.5 w-24 rounded-full bg-white/60" />
                     </div>
                     <TapFinger left="62%" top="58%" />
                  </div>
               ) : isAndroid ? null : (
                  // The real Messenger menu (George's iPhone, 18 Oct): everything else faded, the one to tap ringed.
                  <div className="relative">
                     <img alt="" className="w-full rounded-xl" src="/guide/ios-menu-open-external.png" />
                     <TapFinger left="62%" top="62%" />
                  </div>
               )}
               <div className={isAndroid ? 'relative rounded-xl bg-white text-[15px] text-[#1c1c1e]' : 'hidden'}>
                  <div className="px-2 py-1.5">
                     <div className={`flex items-center gap-2 rounded-lg px-2 py-1.5 font-semibold ${RING}`}>
                        <span aria-hidden="true">{isAndroid ? '🌐' : '🧭'}</span>
                        {menuItem}
                     </div>
                  </div>
                  {isAndroid ? <TapFinger left="62%" top="55%" /> : null}
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
