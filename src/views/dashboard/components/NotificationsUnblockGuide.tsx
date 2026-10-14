import type { ReactNode } from 'react';

import { Bell, Lock, Pointer, SlidersHorizontal, X } from 'lucide-react';

import { GhostButton, PrimaryButton } from '@/views/dashboard/components/connectKit';

// Picture guide for turning notifications back on once the browser has blocked them. One red line
// ("Allow them for moodeng.app in your browser settings") left borrowers to find a three-level menu
// on their own; a borrower on 2026-10-13 spent 17 minutes on it. Each step shows what they'll see.

const isSamsungInternet = () => typeof navigator !== 'undefined' && /SamsungBrowser/i.test(navigator.userAgent);

function StepNumber({ n }: { n: number }) {
   return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#6b55f7] text-[14px] font-bold text-white">
         {n}
      </span>
   );
}

/** A hand pointing at the thing to tap — so the drawing reads as "do this in your browser". */
function TapHand({ className }: { className: string }) {
   return (
      <span className={`absolute motion-safe:animate-bounce ${className}`}>
         <Pointer className="size-6 fill-white text-[#6b55f7] drop-shadow-[0_2px_2px_rgba(27,10,54,0.35)]" strokeWidth={2} />
      </span>
   );
}

/**
 * A grey framed "screenshot" of the browser. Not interactive and deliberately not styled like the
 * app's own controls: an earlier version drew a live-looking switch people would try to flip here.
 */
function Picture({ children }: { children: ReactNode }) {
   return (
      <div aria-hidden="true" className="pointer-events-none ml-10 select-none rounded-[14px] bg-[#e9e5ef] p-2 dark:bg-[#2a2235]">
         <div className="relative rounded-[10px] bg-[#fbfafc] px-2.5 py-2 text-[13px] text-[#5f536d] dark:bg-[#1f1830] dark:text-[#b5acbe]">
            {children}
         </div>
      </div>
   );
}

export default function NotificationsUnblockGuide({
   open,
   isChecking,
   stillBlocked,
   onCheckAgain,
   onClose
}: {
   open: boolean;
   isChecking: boolean;
   /** They tapped "Check again" and it's still blocked. */
   stillBlocked: boolean;
   onCheckAgain: () => void;
   onClose: () => void;
}) {
   if (!open) return null;
   const SiteIcon = isSamsungInternet() ? Lock : SlidersHorizontal;

   return (
      <div className="fixed inset-0 z-[120] flex items-end justify-center bg-[#12071f]/45 sm:items-center" onClick={onClose}>
         <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="unblock-guide-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[440px] rounded-t-[32px] bg-white px-5 pb-5 pt-4 sm:rounded-[32px] dark:bg-[#17121F]"
         >
            <div className="flex items-center justify-between">
               <h2 id="unblock-guide-title" className="text-[20px] font-bold text-[#1b0a36] dark:text-[#F8F4FF]">
                  Turn on reminders
               </h2>
               <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex size-10 items-center justify-center rounded-full text-[#594d65] active:bg-[#f3effe]"
               >
                  <X className="size-6" strokeWidth={2.25} />
               </button>
            </div>

            <ol className="mt-3 flex flex-col gap-4">
               <li className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                     <StepNumber n={1} />
                     <span className="text-[15px] font-semibold text-[#1b0a36] dark:text-[#F8F4FF]">
                        Tap the icon next to the address at the top
                     </span>
                  </div>
                  <Picture>
                     <div className="flex h-8 items-center gap-2 rounded-full bg-[#ece9f1] px-1.5 dark:bg-[#2a2235]">
                        <span className="flex size-6 items-center justify-center rounded-full bg-white dark:bg-[#17121F]">
                           <SiteIcon className="size-3.5" strokeWidth={2.25} />
                        </span>
                        <span>moodeng.app</span>
                     </div>
                     <TapHand className="left-[22px] top-[26px]" />
                  </Picture>
               </li>

               <li className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                     <StepNumber n={2} />
                     <span className="text-[15px] font-semibold text-[#1b0a36] dark:text-[#F8F4FF]">Tap Notifications</span>
                  </div>
                  <Picture>
                     <span className="block text-[11px] text-[#9a8fb0]">Permissions</span>
                     <span className="mt-1 flex items-center gap-2">
                        <Bell className="size-3.5" strokeWidth={2.25} />
                        <span>Notifications</span>
                        <span className="ml-auto text-[#c2414f]">Blocked</span>
                     </span>
                     <TapHand className="left-[118px] top-[32px]" />
                  </Picture>
               </li>

               <li className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                     <StepNumber n={3} />
                     <span className="text-[15px] font-semibold text-[#1b0a36] dark:text-[#F8F4FF]">Switch it to Allow</span>
                  </div>
                  <Picture>
                     <span className="flex items-center gap-2">
                        <span>Allow</span>
                        {/* Drawn off, with the hand on it: the step is to switch it on. */}
                        <span className="ml-auto flex h-4 w-7 items-center rounded-full bg-[#cfc8d8] p-0.5 dark:bg-[#40354f]">
                           <span className="size-3 rounded-full bg-white" />
                        </span>
                     </span>
                     <TapHand className="right-[6px] top-[18px]" />
                  </Picture>
               </li>
            </ol>

            <div className="mt-5 flex flex-col gap-1">
               {stillBlocked ? (
                  <p role="status" className="mb-1 text-center text-[14px] font-medium text-[#a06a00]">
                     Still blocked. Try the steps again, or continue without reminders.
                  </p>
               ) : null}
               <PrimaryButton disabled={isChecking} onClick={onCheckAgain}>
                  {isChecking ? 'Checking…' : 'Check again'}
               </PrimaryButton>
               <GhostButton onClick={onClose}>Not now</GhostButton>
            </div>
         </div>
      </div>
   );
}
