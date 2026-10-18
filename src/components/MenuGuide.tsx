// The "tap ⋯ up here" guide for Facebook's / Messenger's own browser: a dark overlay with a hippo
// pointing at the app's menu (top right), and the two taps drawn as labelled chips. Only that menu can
// open the real browser (on iPhone nothing on the page can open Safari; Meta blocks it). The chips are
// drawings, not buttons: dashed outlines and step numbers, so nobody tries to tap them. Tapping
// anywhere closes it. Used by the first screen (OpenInBrowserPrompt) and by "Open in Safari" anywhere
// (SafariHelpSheet); public/landing/open-in-browser.js draws the same for the home page.

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
         className="connect-ui fixed inset-0 z-[1002] flex flex-col items-end bg-[#120a1f] px-5 pt-2 text-left text-white"
         onClick={onClose}
         role="dialog"
      >
         {/* Points at the real menu, top right, just above this page. */}
         <span aria-hidden="true" className="mr-2 animate-bounce text-[52px] font-black leading-none">
            ↑
         </span>
         <div className="mt-1 flex w-full max-w-[360px] flex-col gap-3 self-end">
            <p id="menu-guide-title" className="text-right text-[24px] font-extrabold leading-[30px]">
               {chromeFailed ? 'Chrome didn’t open? ' : ''}Open Moodeng in {browser} in 2 taps
            </p>
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3">
               <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#FFD43B] text-[16px] font-black text-[#1a0f2e]">1</span>
               <span className="text-[17px] leading-[23px]">Tap</span>
               <span className="flex h-10 min-w-10 items-center justify-center rounded-full border-2 border-dashed border-white/70 px-2 text-[22px] font-black leading-none">
                  {menuIcon}
               </span>
               <span className="text-[17px] leading-[23px]">at the top right</span>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3">
               <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#FFD43B] text-[16px] font-black text-[#1a0f2e]">2</span>
               <span className="text-[17px] leading-[23px]">Tap</span>
               <span className="rounded-xl border-2 border-dashed border-white/70 px-3 py-1.5 text-[16px] font-bold leading-[20px]">
                  {isAndroid ? '' : '🧭 '}
                  {menuItem}
               </span>
            </div>
            <p className="text-right text-[14px] leading-[20px] text-white/70">
               (or <b>{isAndroid ? 'Open in browser' : 'Open in Safari'}</b>){opensOnSignUp ? ` · ${browser} opens straight on sign-up` : ''}
            </p>
         </div>
         <img alt="" className="pointer-events-none mt-auto h-40 w-auto self-start" src="/hippos/hippo-point-up-right.png" />
         <button
            className="mb-8 mt-3 min-h-[48px] w-full max-w-[400px] self-center rounded-full border-2 border-white/40 text-[16px] font-bold text-white"
            onClick={onClose}
            type="button"
         >
            Got it
         </button>
      </div>
   );
}
