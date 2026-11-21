import { useCallback, useRef, useState } from 'react';

import { GhostButton } from '@/views/dashboard/components/connectKit';

// Facebook / Messenger on Android often has no permission to the phone's photos: tapping a file input
// shows "Please allow all media to use file chooser" and nothing opens (George's borrower screenshot,
// 2026-11-21; PostHog showed the same person tapping "Add my proof" 8 times over 3 visits). The camera
// still works there. So we notice when the picker didn't open and offer a way out.

/** Facebook / Messenger's in-app browser on Android. Pure. */
export const isMetaAndroid = (ua: string) => /Android/i.test(ua) && /(FBAN|FBAV|FB_IAB|FB4A|Messenger|MESSENGER|Orca)/i.test(ua);

/**
 * Opens a file input and reports if nothing opened: when a real picker opens, the page loses focus
 * (blur / hidden) within a moment; when Messenger blocks it, nothing happens.
 */
export function usePickerWatch() {
   const [blocked, setBlocked] = useState(false);
   const timer = useRef<number | null>(null);
   const open = useCallback((input: HTMLInputElement | null) => {
      if (!input) return;
      let left = false;
      const onLeave = () => {
         left = true;
      };
      window.addEventListener('blur', onLeave, { once: true });
      document.addEventListener('visibilitychange', onLeave, { once: true });
      input.click();
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
         window.removeEventListener('blur', onLeave);
         document.removeEventListener('visibilitychange', onLeave);
         if (!left && document.hasFocus()) setBlocked(true);
      }, 1500);
   }, []);
   return { blocked, setBlocked, open };
}

/** What to do when the file picker won't open. */
export function PickerHelp({ onCamera, onSkip, skipLabel }: { onCamera: () => void; onSkip?: () => void; skipLabel?: string }) {
   const meta = typeof navigator !== 'undefined' && isMetaAndroid(navigator.userAgent);
   return (
      <div className="flex flex-col gap-3 rounded-[16px] border-2 border-[#f5c46b] bg-[#fff8e8] px-4 py-4 dark:border-[#6b5420] dark:bg-[#2e2512]">
         <p className="text-[16px] font-bold text-[#5a4300] dark:text-[#f3dfa8]">Can’t open your photos? No problem 🙂</p>
         <button className="rounded-[14px] bg-[#6b55f7] px-4 py-3 text-[16px] font-bold text-white" onClick={onCamera} type="button">
            📷 Take a photo of it instead
         </button>
         <p className="-mt-1 text-[13px] text-[#7a6420] dark:text-[#d9c58a]">
            Like your payslip on paper, or your GCash screen on another phone.
         </p>
         {meta ? (
            <div className="rounded-[12px] bg-white/70 px-3 py-2 text-[14px] leading-[20px] text-[#5a4300] dark:bg-black/20 dark:text-[#f3dfa8]">
               <b>Or let Messenger use your photos:</b>
               <br />
               Phone <b>Settings</b> → <b>Apps</b> → <b>Messenger</b> → <b>Permissions</b> → <b>Photos and videos</b> → <b>Allow all</b>.
               Then come back and tap again.
            </div>
         ) : null}
         {onSkip ? <GhostButton onClick={onSkip}>{skipLabel ?? 'Skip for now'}</GhostButton> : null}
      </div>
   );
}
