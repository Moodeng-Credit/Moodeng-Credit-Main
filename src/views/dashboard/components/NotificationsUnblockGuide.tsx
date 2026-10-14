import { Bell, Lock, SlidersHorizontal, X } from 'lucide-react';

import { GhostButton, PrimaryButton } from '@/views/dashboard/components/connectKit';

// Picture guide for turning notifications back on once the browser has blocked them. One red line
// ("Allow them for moodeng.app in your browser settings") left borrowers to find a three-level menu
// on their own; a borrower on 2026-10-13 spent 17 minutes on it. Each step draws what they'll see.

const isSamsungInternet = () => typeof navigator !== 'undefined' && /SamsungBrowser/i.test(navigator.userAgent);

function StepNumber({ n }: { n: number }) {
   return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#6b55f7] text-[14px] font-bold text-white">
         {n}
      </span>
   );
}

/** Ring that pulses around the thing to tap in each drawing. */
const tapRing = 'ring-2 ring-[#6b55f7] ring-offset-2 motion-safe:animate-pulse';

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
                  {/* The browser's address bar, as they'll see it. */}
                  <div className="ml-10 flex h-11 items-center gap-2 rounded-full bg-[#f1eff4] px-2 dark:bg-[#241b38]">
                     <span className={`flex size-8 items-center justify-center rounded-full bg-white dark:bg-[#17121F] ${tapRing}`}>
                        <SiteIcon className="size-4 text-[#1b0a36] dark:text-[#F8F4FF]" strokeWidth={2.25} aria-hidden="true" />
                     </span>
                     <span className="text-[15px] text-[#40354f] dark:text-[#D8CEE6]">moodeng.app</span>
                  </div>
               </li>

               <li className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                     <StepNumber n={2} />
                     <span className="text-[15px] font-semibold text-[#1b0a36] dark:text-[#F8F4FF]">Tap Notifications</span>
                  </div>
                  <div className="ml-10 flex flex-col gap-1 rounded-[16px] border border-[#ece9f1] p-2 dark:border-[#2c2439]">
                     <span className="px-2 text-[12px] text-[#877897]">Permissions</span>
                     <span className={`flex items-center gap-2 rounded-[10px] px-2 py-1.5 ${tapRing}`}>
                        <Bell className="size-4 text-[#1b0a36] dark:text-[#F8F4FF]" strokeWidth={2.25} aria-hidden="true" />
                        <span className="text-[15px] text-[#1b0a36] dark:text-[#F8F4FF]">Notifications</span>
                        <span className="ml-auto text-[13px] text-[#d51728]">Blocked</span>
                     </span>
                  </div>
               </li>

               <li className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                     <StepNumber n={3} />
                     <span className="text-[15px] font-semibold text-[#1b0a36] dark:text-[#F8F4FF]">Switch it to Allow</span>
                  </div>
                  <div className="ml-10 flex items-center gap-3 rounded-[16px] border border-[#ece9f1] px-3 py-2 dark:border-[#2c2439]">
                     <span className="text-[15px] text-[#1b0a36] dark:text-[#F8F4FF]">Allow</span>
                     <span
                        className={`ml-auto flex h-6 w-11 items-center justify-end rounded-full bg-[#4aa256] p-0.5 ${tapRing}`}
                        aria-hidden="true"
                     >
                        <span className="size-5 rounded-full bg-white" />
                     </span>
                  </div>
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
